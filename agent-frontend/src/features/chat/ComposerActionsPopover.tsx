import {useState} from "react";
import {Code2, Ellipsis} from "lucide-react";

import {Button} from "@heroui/react/button";
import {Input} from "@heroui/react/input";
import {ListBox} from "@heroui/react/list-box";
import {Popover} from "@heroui/react/popover";
import {Separator} from "@heroui/react/separator";

import {COMPOSER_BUTTON_STYLE, SLASH_COMMANDS} from "../../lib/constants";

export function ComposerActionsPopover({
  isRunning,
  onCommand,
}: {
  isRunning: boolean;
  onCommand: (command: string) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCommands = SLASH_COMMANDS.filter((command) => command.toLowerCase().includes(normalizedSearch));

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          aria-label="More composer actions"
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
              aria-label="Search routing commands"
              className="h-9 w-full border-0 bg-transparent px-2 text-sm shadow-none"
              placeholder="Search commands"
              value={search}
              variant="secondary"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Separator />
          {filteredCommands.length ? (
            <ListBox
              aria-label="Routing commands"
              className="scrollbar max-h-[min(320px,calc(100vh-10rem))] overflow-y-auto p-2"
            >
              {filteredCommands.map((command) => (
                <ListBox.Item key={command} id={command} textValue={command} onAction={() => onCommand(command)}>
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <Code2 className="size-4 shrink-0 text-muted" />
                    <span className="truncate">{command}</span>
                  </span>
                </ListBox.Item>
              ))}
            </ListBox>
          ) : (
            <div className="text-muted flex h-20 items-center px-5 text-sm">No commands found</div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
