import {
  addEventListener,
  call,
  definePlugin,
  removeEventListener,
  routerHook,
  toaster,
} from "@decky/api";
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ToggleField,
  staticClasses,
} from "@decky/ui";
import { useCallback, useEffect, useState } from "react";
import { FaXbox } from "react-icons/fa";
import XboxNotification, { type NotificationPayload } from "./XboxNotification";

const GLOBAL_COMPONENT_NAME = "XboxAchievementsOverlay";
const EVENT_NAME = "xboxachievements_show";
let overlayToastListener: ((payload: NotificationPayload) => void) | null = null;

type BackendStatus = {
  watcher_running: boolean;
  librarycache_watcher_running: boolean;
  librarycache_files_seen: number;
  last_match_timestamp: string | null;
  last_match_sample: string | null;
  last_match_source: string | null;
  log_path: string;
  librarycache_glob: string;
  duplicate_window_seconds: number;
};

type PluginSettings = {
  rare_threshold_percent: number;
  show_unlock_percentage: boolean;
};

const DEFAULT_SETTINGS: PluginSettings = {
  rare_threshold_percent: 10.0,
  show_unlock_percentage: false,
};

const toErrorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
};

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return "never";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
};

function StatusPanel() {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<NotificationPayload | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await call<[], BackendStatus>("get_status");
      setStatus(next);
      setStatusError(null);
    } catch (error) {
      setStatusError(toErrorMessage(error));
    }
  }, []);

  const updateSettings = useCallback(async (patch: Partial<PluginSettings>) => {
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    try {
      const next = await call<[Partial<PluginSettings>], PluginSettings>(
        "set_settings",
        patch,
      );
      setSettings(next);
    } catch (error) {
      setStatusError(toErrorMessage(error));
    }
  }, [settings]);

  useEffect(() => {
    const listener = addEventListener<[NotificationPayload]>(
      EVENT_NAME,
      (payload) => {
        if (payload) {
          setLastEvent(payload);
        }
      },
    );

    void refreshStatus();
    void (async () => {
      try {
        const loaded = await call<[], PluginSettings>("get_settings");
        setSettings(loaded);
      } catch (error) {
        setStatusError(toErrorMessage(error));
      }
    })();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5000);

    return () => {
      window.clearInterval(interval);
      removeEventListener(EVENT_NAME, listener);
    };
  }, [refreshStatus]);

  const trigger = useCallback(
    async (method: "test_popup_main" | "test_popup_rare") => {
      setPendingAction(method);
      try {
        await call<[], void>(method);
        await refreshStatus();
      } finally {
        setPendingAction(null);
      }
    },
    [refreshStatus],
  );

  return (
    <>
      <PanelSection title="Popup Tests">
        <PanelSectionRow>
          <ButtonItem
            disabled={pendingAction !== null}
            onClick={() => void trigger("test_popup_main")}
            layout="below"
            description="Shows the standard Xbox achievement popup."
          >
            Test Main
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            disabled={pendingAction !== null}
            onClick={() => void trigger("test_popup_rare")}
            layout="below"
            description="Shows the rare variant with glow and rare sound."
          >
            Test Rare
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Settings">
        <PanelSectionRow>
          <ToggleField
            label="Show unlock percentage"
            description="Display the global rarity percent in the popup."
            checked={settings.show_unlock_percentage}
            onChange={(value) => void updateSettings({ show_unlock_percentage: value })}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            label="Rare threshold"
            description="Achievements unlocked by this percent of players or fewer use the rare popup and sound."
            value={settings.rare_threshold_percent}
            min={0}
            max={50}
            step={0.5}
            showValue
            valueSuffix="%"
            onChange={(value) => void updateSettings({ rare_threshold_percent: value })}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Watcher Status">
        <PanelSectionRow>
          <ButtonItem
            disabled={pendingAction !== null}
            onClick={() => void refreshStatus()}
            description="Manually refresh backend status."
          >
            Refresh Status
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <div>
            <div>
              Log watcher: <strong>{status?.watcher_running ? "yes" : "no"}</strong>
            </div>
            <div>
              Cache watcher:{" "}
              <strong>{status?.librarycache_watcher_running ? "yes" : "no"}</strong>
            </div>
            <div>Last match: {formatTimestamp(status?.last_match_timestamp ?? null)}</div>
            <div>Last source: {status?.last_match_source ?? "-"}</div>
            <div>
              Duplicate window: {status?.duplicate_window_seconds ?? "?"}s
            </div>
            <div>Log path: {status?.log_path ?? "unknown"}</div>
            <div>Cache files seen: {status?.librarycache_files_seen ?? "?"}</div>
            <div>Cache glob: {status?.librarycache_glob ?? "unknown"}</div>
            <div>Sample: {status?.last_match_sample ?? "-"}</div>
            <div>
              Last event:{" "}
              {lastEvent
                ? `${lastEvent.title} @ ${formatTimestamp(lastEvent.timestamp)}`
                : "none"}
            </div>
            {statusError ? (
              <div style={{ color: "#ff8a80" }}>Status error: {statusError}</div>
            ) : null}
          </div>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  if (overlayToastListener === null) {
    overlayToastListener = addEventListener<[NotificationPayload]>(
      EVENT_NAME,
      (payload) => {
        if (!payload) {
          return;
        }
        toaster.toast({
          title: payload.title,
          body: payload.subtitle,
          duration: 4200,
          showToast: true,
          playSound: false,
        });
      },
    );
  }

  routerHook.addGlobalComponent(GLOBAL_COMPONENT_NAME, XboxNotification);

  return {
    name: "Xbox Achievements",
    icon: <FaXbox />,
    alwaysRender: true,
    titleView: <div className={staticClasses.Title}>Xbox Achievements</div>,
    content: <StatusPanel />,
    onDismount() {
      routerHook.removeGlobalComponent(GLOBAL_COMPONENT_NAME);
      if (overlayToastListener !== null) {
        removeEventListener(EVENT_NAME, overlayToastListener);
        overlayToastListener = null;
      }
    },
  };
});
