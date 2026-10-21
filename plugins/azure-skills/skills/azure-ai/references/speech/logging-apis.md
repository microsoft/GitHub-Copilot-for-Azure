# Speech SDK logging APIs by language and platform

Copied from the official
[Enable logging in the Speech SDK](https://learn.microsoft.com/azure/ai-services/speech-service/how-to-use-logging)
article (checked 2026-10-19); the article is authoritative if it differs. Pick the
API for the user's language and SDK version. Loggers are process-wide; scope and
privacy are in [collection](collection.md). `path` is the log file path.

## SDK 1.43.0 or later

| Language | File logger | Memory logger dump |
|---|---|---|
| C# | `FileLogger.Start(path)`, `FileLogger.Stop()` (`Microsoft.CognitiveServices.Speech.Diagnostics.Logging`) | `MemoryLogger.Dump(path)` |
| C++ | `FileLogger::Start(path)`, `FileLogger::Stop()` | `MemoryLogger::Dump(path)` |
| Java | `FileLogger.start(path)`, `FileLogger.stop()` (`com.microsoft.cognitiveservices.speech.diagnostics.logging`) | `MemoryLogger.dump(path)` |
| Python | `FileLogger.start(path)`, `FileLogger.stop()` (`azure.cognitiveservices.speech.diagnostics.logging`) | `MemoryLogger.dump(path)` |
| Objective-C | `[SPXFileLogger start:path]`, `[SPXFileLogger stop]` | `[SPXMemoryLogger dumpToFile:path]` |
| Swift (iOS) | `SPXFileLogger.start(path)` | see the article |
| JavaScript | `sdk.Diagnostics.SetLoggingLevel(sdk.LogLevel.Debug)`, `sdk.Diagnostics.SetLogOutputPath(path)` | not applicable |

JavaScript uses a separate implementation and log format, so the native-format
analyzer does not apply. For Go the article documents only the legacy property.
EventLogger callbacks and filters are in the article's per-language samples.

## Before SDK 1.43.0

The article documents the legacy `Speech_LogFilename` property on the speech
configuration:

| Language | Call |
|---|---|
| C# | `speechConfig.SetProperty(PropertyId.Speech_LogFilename, path)` |
| C++ | `speechConfig->SetProperty(PropertyId::Speech_LogFilename, path)` |
| Java | `speechConfig.setProperty(PropertyId.Speech_LogFilename, path)` |
| Python | `speech_config.set_property(speechsdk.PropertyId.Speech_LogFilename, path)` |
| Objective-C | `[speechConfig setPropertyTo:path byId:SPXSpeechLogFilename]` |
| Go | `speechConfig.SetProperty(common.SpeechLogFilename, path)` |

Creating a recognizer from that configuration enables logging for all
recognizers. A `SpeechSynthesizer` created from it does not enable logging,
although synthesizer diagnostics appear when logging is already enabled; the
article's C++ helper enables logging with a temporary recognizer for that reason.
The latest recognizer created sets the file for all SDK logging, and releasing an
object does not stop logging; the article stops it by creating a new object with
an empty path.

## Log file location by platform

- Windows and Linux: any path the user can write.
- UWP: an application data folder (local, roaming or temporary).
- Android: internal, external or cache storage. The article's example uses
  `context.getExternalFilesDir(null)` and lists the manifest permission and Unity
  setting it requires.
- iOS: only the app sandbox (documents, library, temp). Files in the documents
  directory can be exposed to users with the two `Info.plist` keys in the article.

Other operating systems can restrict writes by default.
