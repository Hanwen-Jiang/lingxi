import {useState} from "react";
import {Code2, Ellipsis} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Input} from "@heroui/react/input";
import {ListBox} from "@heroui/react/list-box";
import {Popover} from "@heroui/react/popover";
import {Separator} from "@heroui/react/separator";

import {CHAT_MODES, COMPOSER_BUTTON_STYLE, SLASH_COMMAND_MODES, SLASH_COMMANDS} from "../../lib/constants";

// Each slash command is a shortcut to a chat mode (M3); show its human label
// next to the command so the popover reads as a mode picker.
const COMMAND_ENTRIES = SLASH_COMMANDS.map((command) => {
  const modeId = SLASH_COMMAND_MODES[command];
  return {command, label: CHAT_MODES.find((candidate) => candidate.id === modeId)?.label ?? command};
});

export function ComposerActionsPopover({
  isRunning,
  onCommand,
}: {
  isRunning: boolean;
  onCommand: (command: string) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCommands = COMMAND_ENTRIES.filter(
    ({command, label}) =>
      command.toLowerCase().includes(normalizedSearch) || label.toLowerCase().includes(normalizedSearch),
  );

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          aria-label="更多操作"
          className="composer-icon-button"
          isDisabled={isRunning}
          size="sm"
          style={COMPOSER_BUTTON_STYLE}
          variant="outline"
        >
          <Ellipsis className="size-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
        placement="top start"
      >
        <Popover.Dialog className="p-0">
          <div className="p-2">
            <Input
              autoFocus
              fullWidth
              aria-label="搜索命令"
              className="h-9 w-full border-0 bg-transparent px-2 text-sm shadow-none"
              placeholder="搜索命令"
              value={search}
              variant="secondary"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Separator />
          {filteredCommands.length ? (
            <ListBox
              aria-label="命令列表"
              className="scrollbar max-h-[min(320px,calc(100vh-10rem))] overflow-y-auto p-2"
            >
              {filteredCommands.map(({command, label}) => (
                <ListBox.Item key={command} id={command} textValue={label} onAction={() => onCommand(command)}>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Code2 className="size-4 shrink-0 text-muted" />
                    <span className="truncate">{label}</span>
                    <span className="text-muted ml-auto shrink-0 text-xs">{command}</span>
                  </span>
                </ListBox.Item>
              ))}
            </ListBox>
          ) : (
            <div className="text-muted flex h-20 items-center px-5 text-sm">没有匹配的命令</div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
