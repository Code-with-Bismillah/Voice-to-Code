import * as vscode from "vscode"
import { spawn, type ChildProcess } from "child_process"
import * as path from "path"
import * as fs from "fs"

let isListening = false
let pythonProcess: ChildProcess | null = null
let statusBarItem: vscode.StatusBarItem

export function activate(context: vscode.ExtensionContext) {
  console.log("Voice to Code extension is now active!")

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.command = "voice-to-code.toggleListening"
  updateStatusBar()
  statusBarItem.show()

  // Register commands
  const startListeningCommand = vscode.commands.registerCommand("voice-to-code.startListening", () => {
    startListening(context)
  })

  const stopListeningCommand = vscode.commands.registerCommand("voice-to-code.stopListening", () => {
    stopListening()
  })

  const toggleListeningCommand = vscode.commands.registerCommand("voice-to-code.toggleListening", () => {
    if (isListening) {
      stopListening()
    } else {
      startListening(context)
    }
  })

  const insertCodeCommand = vscode.commands.registerCommand("voice-to-code.insertCode", (code: string) => {
    insertCodeIntoEditor(code)
  })

  const createNewFileCommand = vscode.commands.registerCommand("voice-to-code.createNewFile", async () => {
    try {
      const doc = await vscode.workspace.openTextDocument({
        content: "// Voice to Code - Start speaking!\n",
        language: "javascript",
      })
      await vscode.window.showTextDocument(doc)
      vscode.window.showInformationMessage("New file created! You can now start voice coding.")
    } catch (error) {
      vscode.window.showErrorMessage("Failed to create new file")
    }
  })

  const checkPythonCommand = vscode.commands.registerCommand("voice-to-code.checkPython", async () => {
    await checkAndDisplayPythonStatus()
  })

  const transcribeMediaCommand = vscode.commands.registerCommand("voice-to-code.transcribeMedia", async () => {
    await transcribeMediaFile(context)
  })

  const transcribeCurrentMediaCommand = vscode.commands.registerCommand(
    "voice-to-code.transcribeCurrentMedia",
    async () => {
      await transcribeCurrentMediaFile(context)
    },
  )

  const installDependenciesCommand = vscode.commands.registerCommand("voice-to-code.installDependencies", async () => {
    await installPythonDependencies()
  })

  context.subscriptions.push(
    startListeningCommand,
    stopListeningCommand,
    toggleListeningCommand,
    insertCodeCommand,
    createNewFileCommand,
    checkPythonCommand,
    transcribeMediaCommand,
    transcribeCurrentMediaCommand,
    installDependenciesCommand,
    statusBarItem,
  )
}

function updateStatusBar() {
  if (isListening) {
    statusBarItem.text = "$(mic) Listening..."
    statusBarItem.tooltip = "Voice to Code is listening. Click to stop."
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground")
  } else {
    statusBarItem.text = "$(mic-off) Voice to Code"
    statusBarItem.tooltip = "Click to start voice listening"
    statusBarItem.backgroundColor = undefined
  }
}

async function installPythonDependencies() {
  try {
    const pythonPath = await findPythonExecutable()

    const action = await vscode.window.showInformationMessage(
      "This will install required Python packages: SpeechRecognition, pydub, moviepy, ffmpeg-python",
      "Install Now",
      "Cancel",
    )

    if (action === "Install Now") {
      const terminal = vscode.window.createTerminal("Voice to Code - Install Dependencies")
      terminal.sendText(`${pythonPath} -m pip install --upgrade pip`)
      terminal.sendText(`${pythonPath} -m pip install SpeechRecognition pydub moviepy ffmpeg-python`)
      terminal.show()

      vscode.window.showInformationMessage(
        "Installing dependencies... Check the terminal for progress. You may also need to install FFmpeg separately for video support.",
      )
    }
  } catch (error) {
    vscode.window.showErrorMessage("Python not found. Please install Python first.")
  }
}

async function findPythonExecutable(): Promise<string> {
  const possiblePaths = [
    "python3",
    "python",
    "/usr/bin/python3",
    "/usr/bin/python",
    "/usr/local/bin/python3",
    "/usr/local/bin/python",
    "C:\\Python39\\python.exe",
    "C:\\Python310\\python.exe",
    "C:\\Python311\\python.exe",
    "C:\\Python312\\python.exe",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Python\\Python39\\python.exe",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Python\\Python310\\python.exe",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
    "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
  ]

  // First try the configured path
  const config = vscode.workspace.getConfiguration("voice-to-code")
  const configuredPath = config.get<string>("pythonPath", "python")

  for (const pythonPath of [configuredPath, ...possiblePaths]) {
    try {
      await checkPythonAvailability(pythonPath)
      return pythonPath
    } catch {
      continue
    }
  }

  throw new Error("Python executable not found")
}

async function checkAndDisplayPythonStatus() {
  try {
    const pythonPath = await findPythonExecutable()

    // Check Python version
    const versionCheck = spawn(pythonPath, ["--version"])
    let version = ""

    versionCheck.stdout?.on("data", (data) => {
      version += data.toString()
    })

    versionCheck.stderr?.on("data", (data) => {
      version += data.toString()
    })

    versionCheck.on("close", () => {
      vscode.window.showInformationMessage(`Python found: ${pythonPath}\nVersion: ${version.trim()}`)
    })
  } catch (error) {
    const action = await vscode.window.showErrorMessage(
      "Python not found! Please install Python or configure the correct path.",
      "Install Python",
      "Configure Path",
      "Help",
    )

    if (action === "Install Python") {
      vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"))
    } else if (action === "Configure Path") {
      vscode.commands.executeCommand("workbench.action.openSettings", "voice-to-code.pythonPath")
    } else if (action === "Help") {
      showPythonSetupHelp()
    }
  }
}

function showPythonSetupHelp() {
  const helpMessage = `
**Python Setup Help for Voice to Code Extension**

**Option 1: Install Python**
1. Go to https://python.org/downloads/
2. Download and install Python 3.7 or later
3. Make sure to check "Add Python to PATH" during installation

**Option 2: Configure Python Path**
1. Open VS Code Settings (Ctrl+,)
2. Search for "voice-to-code.pythonPath"
3. Set the full path to your Python executable

**Install Dependencies:**
After Python is set up, run:
\`pip install SpeechRecognition pydub moviepy ffmpeg-python\`

**For Video Support (Recommended):**
Install FFmpeg from https://ffmpeg.org/download.html

**Test Python:**
Use the command "Voice to Code: Check Python Setup" to verify your installation.
  `

  vscode.window.showInformationMessage(helpMessage, { modal: true })
}

async function transcribeMediaFile(context: vscode.ExtensionContext) {
  try {
    // Show file picker for media files
    const mediaFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        "Media Files": [
          "mp3",
          "wav",
          "m4a",
          "ogg",
          "flac",
          "aac",
          "wma",
          "opus",
          "webm",
          "mp4",
          "avi",
          "mkv",
          "mov",
          "wmv",
          "flv",
          "m4v",
          "3gp",
        ],
        "Audio Files": ["mp3", "wav", "m4a", "ogg", "flac", "aac", "wma", "opus", "webm"],
        "Video Files": ["mp4", "avi", "mkv", "mov", "wmv", "flv", "m4v", "3gp"],
      },
      title: "Select Media File to Transcribe",
    })

    if (!mediaFiles || mediaFiles.length === 0) {
      return
    }

    const mediaFilePath = mediaFiles[0].fsPath
    await performMediaTranscription(context, mediaFilePath)
  } catch (error) {
    vscode.window.showErrorMessage(`Error selecting media file: ${error}`)
  }
}

async function transcribeCurrentMediaFile(context: vscode.ExtensionContext) {
  const activeEditor = vscode.window.activeTextEditor
  if (!activeEditor) {
    vscode.window.showErrorMessage("No active file. Please open a media file first.")
    return
  }

  const currentFilePath = activeEditor.document.uri.fsPath
  const fileExtension = path.extname(currentFilePath).toLowerCase()

  // Check if current file is a media file
  const mediaExtensions = [
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".flac",
    ".aac",
    ".wma",
    ".opus",
    ".webm",
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".wmv",
    ".flv",
    ".m4v",
    ".3gp",
  ]

  if (!mediaExtensions.includes(fileExtension)) {
    vscode.window.showErrorMessage(
      "Current file is not a media file. Please open a media file or use 'Transcribe Media File' command.",
    )
    return
  }

  await performMediaTranscription(context, currentFilePath)
}

async function performMediaTranscription(context: vscode.ExtensionContext, mediaFilePath: string) {
  try {
    const pythonPath = await findPythonExecutable()
    const config = vscode.workspace.getConfiguration("voice-to-code")
    const language = config.get<string>("language", "en-US")

    // Check file size to determine if we should use chunk mode
    const stats = fs.statSync(mediaFilePath)
    const fileSizeMB = stats.size / (1024 * 1024)
    const useChunkMode = fileSizeMB > 25 // Use chunks for files larger than 25MB

    const pythonScriptPath = path.join(context.extensionPath, "python", "audio_transcribe.py")

    const fileName = path.basename(mediaFilePath)
    const fileType =
      path.extname(mediaFilePath).toLowerCase().includes("mp4") ||
      path.extname(mediaFilePath).toLowerCase().includes("avi") ||
      path.extname(mediaFilePath).toLowerCase().includes("mkv")
        ? "video"
        : "audio"

    vscode.window.showInformationMessage(`Transcribing ${fileType} file: ${fileName}...`)

    const transcriptionProcess = spawn(
      pythonPath,
      [pythonScriptPath, mediaFilePath, language, useChunkMode.toString()],
      {
        cwd: path.join(context.extensionPath, "python"),
      },
    )

    let transcriptionText = ""
    let isCapturing = false

    transcriptionProcess.stdout?.on("data", (data) => {
      const output = data.toString()

      if (output.includes("TRANSCRIPTION_START")) {
        isCapturing = true
        return
      }

      if (output.includes("TRANSCRIPTION_END")) {
        isCapturing = false
        // Process the complete transcription
        if (transcriptionText.trim()) {
          handleTranscriptionResult(transcriptionText.trim(), mediaFilePath)
        } else {
          vscode.window.showWarningMessage("No speech detected in the media file.")
        }
        return
      }

      if (isCapturing) {
        transcriptionText += output
      }
    })

    transcriptionProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      console.log("Transcription progress:", error)

      if (error.includes("Missing dependencies")) {
        vscode.window
          .showErrorMessage(
            "Required Python modules not found. Click 'Install Dependencies' to install them automatically.",
            "Install Dependencies",
            "Manual Install",
          )
          .then((action) => {
            if (action === "Install Dependencies") {
              vscode.commands.executeCommand("voice-to-code.installDependencies")
            } else if (action === "Manual Install") {
              const terminal = vscode.window.createTerminal("Voice to Code Setup")
              terminal.sendText("pip install SpeechRecognition pydub moviepy ffmpeg-python")
              terminal.show()
            }
          })
      }
    })

    transcriptionProcess.on("close", (code) => {
      if (code === 0) {
        if (!transcriptionText.trim()) {
          vscode.window.showWarningMessage("Transcription completed but no speech was detected.")
        }
      } else {
        vscode.window.showErrorMessage(`Transcription failed with error code: ${code}`)
      }
    })

    transcriptionProcess.on("error", (error) => {
      vscode.window.showErrorMessage(`Failed to start transcription: ${error.message}`)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("Python executable not found")) {
      const action = await vscode.window.showErrorMessage(
        "Python not found! Voice to Code requires Python to be installed.",
        "Install Python",
        "Configure Path",
        "Help",
      )

      if (action === "Install Python") {
        vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"))
      } else if (action === "Configure Path") {
        vscode.commands.executeCommand("workbench.action.openSettings", "voice-to-code.pythonPath")
      } else if (action === "Help") {
        showPythonSetupHelp()
      }
    } else {
      vscode.window.showErrorMessage(`Error transcribing media: ${errorMessage}`)
    }
  }
}

async function handleTranscriptionResult(transcriptionText: string, mediaFilePath: string) {
  const config = vscode.workspace.getConfiguration("voice-to-code")
  const autoInsert = config.get<boolean>("autoInsert", true)

  // Process the transcription to code
  const processedCode = processVoiceToCode(transcriptionText)

  if (autoInsert) {
    // Create a new document with the transcription
    const fileName = path.basename(mediaFilePath, path.extname(mediaFilePath))
    const doc = await vscode.workspace.openTextDocument({
      content: `// Transcription from: ${fileName}\n// Original text: ${transcriptionText}\n\n${processedCode}`,
      language: "javascript",
    })
    await vscode.window.showTextDocument(doc)
    vscode.window.showInformationMessage(
      `Media transcribed successfully! Generated ${processedCode.length} characters of code.`,
    )
  } else {
    // Show preview
    const action = await vscode.window.showInformationMessage(
      `Transcription: "${transcriptionText}"\nGenerated code: ${processedCode}`,
      "Insert Code",
      "Create New File",
      "Copy to Clipboard",
    )

    if (action === "Insert Code") {
      insertCodeIntoEditor(processedCode)
    } else if (action === "Create New File") {
      const fileName = path.basename(mediaFilePath, path.extname(mediaFilePath))
      const doc = await vscode.workspace.openTextDocument({
        content: `// Transcription from: ${fileName}\n// Original text: ${transcriptionText}\n\n${processedCode}`,
        language: "javascript",
      })
      await vscode.window.showTextDocument(doc)
    } else if (action === "Copy to Clipboard") {
      await vscode.env.clipboard.writeText(processedCode)
      vscode.window.showInformationMessage("Code copied to clipboard!")
    }
  }
}

async function startListening(context: vscode.ExtensionContext) {
  if (isListening) {
    vscode.window.showWarningMessage("Voice listening is already active!")
    return
  }

  // Check if there's an active editor or offer to create one
  if (!vscode.window.activeTextEditor) {
    const action = await vscode.window.showInformationMessage(
      "No active editor found. Would you like to create a new file?",
      "Create New File",
      "Cancel",
    )

    if (action === "Create New File") {
      try {
        const doc = await vscode.workspace.openTextDocument({ content: "", language: "javascript" })
        await vscode.window.showTextDocument(doc)
      } catch (error) {
        vscode.window.showErrorMessage("Failed to create new file")
        return
      }
    } else {
      return
    }
  }

  const config = vscode.workspace.getConfiguration("voice-to-code")
  const language = config.get<string>("language", "en-US")

  try {
    // Find Python executable
    const pythonPath = await findPythonExecutable()

    // Check if the web script exists, otherwise use fallback
    const pythonScriptPath = path.join(context.extensionPath, "python", "voice_listen_web.py")
    const fallbackScriptPath = path.join(context.extensionPath, "python", "voice_listen.py")

    let scriptToUse = pythonScriptPath
    try {
      if (!fs.existsSync(pythonScriptPath)) {
        scriptToUse = fallbackScriptPath
      }
    } catch {
      scriptToUse = fallbackScriptPath
    }

    pythonProcess = spawn(pythonPath, [scriptToUse, language], {
      cwd: path.join(context.extensionPath, "python"),
    })

    isListening = true
    updateStatusBar()

    vscode.window.showInformationMessage("Voice listening started! Speak your code...")

    pythonProcess.stdout?.on("data", (data) => {
      const output = data.toString().trim()
      if (output && output !== "") {
        handleVoiceInput(output)
      }
    })

    pythonProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      console.error("Python script error:", error)
      if (error.includes("ModuleNotFoundError")) {
        vscode.window
          .showErrorMessage(
            "Required Python modules not found. Click 'Install Dependencies' to install them automatically.",
            "Install Dependencies",
            "Help",
          )
          .then((action) => {
            if (action === "Install Dependencies") {
              vscode.commands.executeCommand("voice-to-code.installDependencies")
            } else if (action === "Help") {
              showPythonSetupHelp()
            }
          })
      } else if (error.includes("Microphone initialization failed")) {
        vscode.window.showErrorMessage("Microphone access failed. Please check microphone permissions and try again.")
      }
    })

    pythonProcess.on("close", (code) => {
      isListening = false
      updateStatusBar()
      if (code !== 0 && code !== null) {
        vscode.window.showErrorMessage(`Voice listening stopped with error code: ${code}`)
      }
    })

    pythonProcess.on("error", (error) => {
      isListening = false
      updateStatusBar()
      vscode.window.showErrorMessage(`Failed to start voice listening: ${error.message}`)
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("Python executable not found")) {
      const action = await vscode.window.showErrorMessage(
        "Python not found! Voice to Code requires Python to be installed.",
        "Install Python",
        "Configure Path",
        "Help",
      )

      if (action === "Install Python") {
        vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"))
      } else if (action === "Configure Path") {
        vscode.commands.executeCommand("workbench.action.openSettings", "voice-to-code.pythonPath")
      } else if (action === "Help") {
        showPythonSetupHelp()
      }
    } else {
      vscode.window.showErrorMessage(`Error starting voice listening: ${errorMessage}`)
    }
  }
}

function stopListening() {
  if (!isListening) {
    vscode.window.showWarningMessage("Voice listening is not active!")
    return
  }

  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }

  isListening = false
  updateStatusBar()
  vscode.window.showInformationMessage("Voice listening stopped.")
}

async function handleVoiceInput(voiceText: string) {
  const config = vscode.workspace.getConfiguration("voice-to-code")
  const autoInsert = config.get<boolean>("autoInsert", true)
  const showPreview = config.get<boolean>("showPreview", true)

  // Process voice text to code
  const processedCode = processVoiceToCode(voiceText)

  if (showPreview && !autoInsert) {
    const action = await vscode.window.showInformationMessage(
      `Recognized: "${voiceText}"\nGenerated code: ${processedCode}`,
      "Insert Code",
      "Dismiss",
    )

    if (action === "Insert Code") {
      insertCodeIntoEditor(processedCode)
    }
  } else if (autoInsert) {
    insertCodeIntoEditor(processedCode)
    vscode.window.showInformationMessage(`Inserted: ${processedCode}`)
  }
}

function processVoiceToCode(voiceText: string): string {
  // Convert common voice commands to code
  const lowerText = voiceText.toLowerCase()

  // Basic code patterns
  const codePatterns: { [key: string]: string } = {
    function: "function ",
    const: "const ",
    let: "let ",
    var: "var ",
    if: "if (",
    else: "else ",
    for: "for (",
    while: "while (",
    return: "return ",
    "console log": "console.log(",
    "console dot log": "console.log(",
    "new line": "\n",
    semicolon: ";",
    "open brace": "{",
    "close brace": "}",
    "open parenthesis": "(",
    "close parenthesis": ")",
    "open bracket": "[",
    "close bracket": "]",
    equals: " = ",
    plus: " + ",
    minus: " - ",
    multiply: " * ",
    divide: " / ",
    dot: ".",
    comma: ", ",
    quote: '"',
    "single quote": "'",
    "arrow function": " => ",
    async: "async ",
    await: "await ",
    try: "try {",
    catch: "catch (",
    finally: "finally {",
    class: "class ",
    extends: " extends ",
    import: "import ",
    export: "export ",
    from: " from ",
    default: "default ",
  }

  let result = lowerText

  // Apply code patterns
  for (const [pattern, replacement] of Object.entries(codePatterns)) {
    result = result.replace(new RegExp(pattern, "gi"), replacement)
  }

  // Handle numbers
  result = result.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (match) => {
    const numbers: { [key: string]: string } = {
      zero: "0",
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
      ten: "10",
    }
    return numbers[match.toLowerCase()] || match
  })

  return result
}

async function insertCodeIntoEditor(code: string) {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    // Try to create a new untitled document if no editor is active
    try {
      const doc = await vscode.workspace.openTextDocument({ content: "", language: "javascript" })
      const newEditor = await vscode.window.showTextDocument(doc)
      const position = newEditor.selection.active
      await newEditor.edit((editBuilder) => {
        editBuilder.insert(position, code)
      })
      vscode.window.showInformationMessage(`Inserted code in new file: ${code}`)
    } catch (error) {
      vscode.window.showErrorMessage("No active editor found! Please open a file or create a new one first.")
    }
    return
  }

  const position = editor.selection.active
  await editor.edit((editBuilder) => {
    editBuilder.insert(position, code)
  })
}

async function checkPythonAvailability(pythonPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonCheck = spawn(pythonPath, ["--version"])

    pythonCheck.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error("Python is not available or not properly installed"))
      }
    })

    pythonCheck.on("error", (error) => {
      reject(new Error(`Python executable not found: ${error.message}`))
    })
  })
}

export function deactivate() {
  if (pythonProcess) {
    pythonProcess.kill()
  }
  if (statusBarItem) {
    statusBarItem.dispose()
  }
}
