import { OutputChannel, window } from "vscode";
import { SystemSettings } from "./models/configurationSettings";
import { LogLevel } from "./models/logLevel";

class Log {
  private readonly _outputChannel: OutputChannel;
  private readonly _oneRequestSettings: SystemSettings =
    SystemSettings.Instance;
  public constructor() {
    this._outputChannel = window.createOutputChannel("One Request");
  }

  public verbose(message: string, data?: unknown): void {
    this.log(LogLevel.Verbose, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.log(LogLevel.Info, message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.log(LogLevel.Warn, message, data);
  }

  public error(message: string, data?: unknown): void {
    this.log(LogLevel.Error, message, data);
  }

  public log(level: LogLevel, message: string, data?: unknown): void {
    if (level >= this._oneRequestSettings.logLevel) {
      this._outputChannel.appendLine(
        `[${LogLevel[level]} - ${new Date().toLocaleTimeString()}] ${message}`,
      );
      if (data) {
        this._outputChannel.appendLine(this.data2String(data));
      }
    }
  }

  private data2String(data: unknown): string {
    if (data instanceof Error) {
      return data.stack || data.message;
    }

    if (typeof data === "string") {
      return data;
    }

    return JSON.stringify(data, null, 2);
  }
}

const Logger = new Log();
export default Logger;
