import { MoreVertical, EyeOff, Unplug } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardTileMenuProps {
  connected: boolean;
  canDisconnect?: boolean;
  disconnectDisabledReason?: string;
  onDisconnect: () => void;
  onHide: () => void;
  testId?: string;
}

export function DashboardTileMenu({
  connected,
  canDisconnect = true,
  disconnectDisabledReason,
  onDisconnect,
  onHide,
  testId,
}: DashboardTileMenuProps) {
  const disconnectDisabled = !connected || !canDisconnect;
  const tooltip = !connected
    ? "Not connected"
    : !canDisconnect
      ? disconnectDisabledReason || ""
      : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Tile actions"
          data-testid={testId}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors -mr-1 -mt-1"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem
          disabled={disconnectDisabled}
          onSelect={(e) => {
            if (disconnectDisabled) {
              e.preventDefault();
              return;
            }
            onDisconnect();
          }}
          title={tooltip}
          className="text-destructive focus:text-destructive"
        >
          <Unplug className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onHide();
          }}
        >
          <EyeOff className="w-4 h-4 mr-2" />
          Hide tool
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
