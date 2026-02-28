import { extensions } from "vscode";
import * as Constants from "../common/constants";
import { SystemSettings } from "../models/configurationSettings";

type TelemetryClient = {
  trackEvent: (data: { name: string; properties?: { [key: string]: string } }) => void;
  context: {
    tags: Record<string, string | undefined>;
    keys: {
      applicationVersion: string;
    };
  };
};

export class Telemetry {
  private static readonly oneRequestSettings: SystemSettings =
    SystemSettings.Instance;

  private static defaultClient: TelemetryClient | undefined;
  private static initializePromise: Promise<TelemetryClient | undefined> | undefined;

  private static async initialize(): Promise<TelemetryClient | undefined> {
    try {
      const appInsights = await import("applicationinsights");
      appInsights
        .setup(Constants.AiKey)
        .setAutoCollectConsole(false)
        .setAutoCollectDependencies(false)
        .setAutoCollectExceptions(false)
        .setAutoCollectPerformance(false, false)
        .setAutoCollectRequests(false)
        .setAutoDependencyCorrelation(false)
        .setUseDiskRetryCaching(true)
        .start();

      const defaultClient = appInsights.defaultClient as
        | TelemetryClient
        | undefined;
      if (!defaultClient) {
        return undefined;
      }

      const context = defaultClient.context;
      const extension = extensions.getExtension(Constants.ExtensionId);
      context.tags[context.keys.applicationVersion] =
        extension?.packageJSON.version;
      this.defaultClient = defaultClient;
      return defaultClient;
    } catch {
      return undefined;
    }
  }

  private static async getClient(): Promise<TelemetryClient | undefined> {
    if (!this.oneRequestSettings.enableTelemetry) {
      return undefined;
    }

    if (this.defaultClient) {
      return this.defaultClient;
    }

    if (!this.initializePromise) {
      this.initializePromise = this.initialize();
    }

    return this.initializePromise;
  }

  public static sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
  ) {
    void this.trackEvent(eventName, properties);
  }

  private static async trackEvent(
    eventName: string,
    properties?: { [key: string]: string },
  ) {
    const client = await this.getClient();
    client?.trackEvent({ name: eventName, properties });
  }
}
