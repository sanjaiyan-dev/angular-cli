/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import yargs from 'yargs';
import { FullDescribe } from './command-module';

export interface JsonHelp {
  name: string;
  description?: string;
  command: string;
  longDescription?: string;
  longDescriptionRelativePath?: string;
  options: JsonHelpOption[];
  subcommands?: {
    name: string;
    description: string;
    aliases: string[];
    deprecated: string | boolean;
  }[];
}

interface JsonHelpOption {
  name: string;
  type?: string;
  deprecated: boolean | string;
  aliases?: string[];
  default?: string;
  required?: boolean;
  positional?: number;
  enum?: string[];
  description?: string;
}

export function jsonHelpUsage(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localYargs = yargs as any;
  const {
    deprecatedOptions,
    alias: aliases,
    array,
    string,
    boolean,
    number,
    choices,
    demandedOptions,
    default: defaultVal,
    hiddenOptions = [],
  } = localYargs.getOptions();

  const internalMethods = localYargs.getInternalMethods();
  const usageInstance = internalMethods.getUsageInstance();
  const context = internalMethods.getContext();
  const descriptions = usageInstance.getDescriptions();
  const groups = localYargs.getGroups();
  const positional = groups[usageInstance.getPositionalGroupName()] as string[] | undefined;

  const hidden = new Set(hiddenOptions);
  const normalizeOptions: JsonHelpOption[] = [];
  const allAliases = new Set([...Object.values<string[]>(aliases).flat()]);

  for (const [names, type] of [
    [array, 'array'],
    [string, 'string'],
    [boolean, 'boolean'],
    [number, 'number'],
  ]) {
    for (const name of names) {
      if (allAliases.has(name) || hidden.has(name)) {
        // Ignore hidden, aliases and already visited option.
        continue;
      }

      const positionalIndex = positional?.indexOf(name) ?? -1;
      const alias = aliases[name];

      normalizeOptions.push({
        name,
        type,
        deprecated: deprecatedOptions[name],
        aliases: alias?.length > 0 ? alias : undefined,
        default: defaultVal[name],
        required: demandedOptions[name],
        enum: choices[name],
        description: descriptions[name]?.replace('__yargsString__:', ''),
        positional: positionalIndex >= 0 ? positionalIndex : undefined,
      });
    }
  }

  // https://github.com/yargs/yargs/blob/00e4ebbe3acd438e73fdb101e75b4f879eb6d345/lib/usage.ts#L124
  const subcommands = (
    usageInstance.getCommands() as [
      name: string,
      description: string,
      isDefault: boolean,
      aliases: string[],
      deprecated: string | boolean,
    ][]
  )
    .map(([name, description, _, aliases, deprecated]) => ({
      name: name.split(' ', 1)[0],
      command: name,
      description,
      aliases,
      deprecated,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const parseDescription = (rawDescription: string) => {
    try {
      const {
        longDescription,
        describe: description,
        longDescriptionRelativePath,
      } = JSON.parse(rawDescription) as FullDescribe;

      return {
        description,
        longDescriptionRelativePath,
        longDescription,
      };
    } catch {
      return {
        description: rawDescription,
      };
    }
  };

  const [command, rawDescription] = usageInstance.getUsage()[0] ?? [];

  const output: JsonHelp = {
    name: [...context.commands].pop(),
    command: command?.replace('$0', localYargs['$0']),
    ...parseDescription(rawDescription),
    options: normalizeOptions.sort((a, b) => a.name.localeCompare(b.name)),
    subcommands: subcommands.length ? subcommands : undefined,
  };

  return JSON.stringify(output, undefined, 2);
}