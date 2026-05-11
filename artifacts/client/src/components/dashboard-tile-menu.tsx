import { MoreVertical, EyeOff, Unplug, Pencil } from "lucide-react";
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
  onUpdate?: () => void;
  onHide: () => void;
  testId?: string;
}

export function DashboardTileMenu({
  connected,
  canDisconnect = true,
  disconnectDisabledReason,
  onDisconnect,
  onUpdate,
  onHide,
  testId,
}: DashboardTileMenuProps) {
  const disconnectDisabled = !connected || !canDisconnect;
  const reason = !canDisconnect
    ? disconnectDisabledReason
    : !connected
      ? "Not connected"
      : undefined;
  const updateDisabled = !connected;
  const updateReason = !connected ? "Not connected" : undefined;

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
          title={reason}
          className="text-destructive focus:text-destructive flex-col items-start gap-0.5"
        >
          <span className="flex items-center">
            <Unplug className="w-4 h-4 mr-2" />
            Disconnect
          </span>
          {disconnectDisabled && reason && (
            <span className="text-[11px] text-muted-foreground pl-6">{reason}</span>
          )}
        </DropdownMenuItem>
        {onUpdate && (
          <DropdownMenuItem
            disabled={updateDisabled}
            onSelect={(e) => {
              if (updateDisabled) {
                e.preventDefault();
                return;
              }
              onUpdate();
            }}
            title={updateReason}
            className="flex-col items-start gap-0.5"
          >
            <span className="flex items-center">
              <Pencil className="w-4 h-4 mr-2" />
              Update connection
            </span>
            {updateDisabled && updateReason && (
              <span className="text-[11px] text-muted-foreground pl-6">{updateReason}</span>
            )}
          </DropdownMenuItem>
        )}
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
