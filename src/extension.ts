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

  context.subscriptions.push(
    startListeningCommand,
    stopListeningCommand,
    toggleListeningCommand,
    insertCodeCommand,
    createNewFileCommand,
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
  const pythonPath = config.get<string>("pythonPath", "python")
  const language = config.get<string>("language", "en-US")

  try {
    // Check if Python is available
    await checkPythonAvailability(pythonPath)

    // Try the web-based script first, fallback to original if needed
    const pythonScriptPath = path.join(context.extensionPath, "python", "voice_listen_web.py")
    const fallbackScriptPath = path.join(context.extensionPath, "python", "voice_listen.py")

    let scriptToUse = pythonScriptPath

    // Check if the web script exists, otherwise use fallback
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
        vscode.window.showErrorMessage(
          "Required Python modules not found. Please install dependencies: pip install SpeechRecognition",
        )
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
    vscode.window.showErrorMessage(`Error starting voice listening: ${error}`)
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
