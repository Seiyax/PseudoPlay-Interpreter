// --- ELEMENTS ---
const editor = document.getElementById('editor');
const highlight = document.getElementById('highlight');
const lineGutter = document.getElementById('line-gutter');
const terminal = document.getElementById('terminal');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn'); // <-- NEW
const clearTerminalBtn = document.getElementById('clearTerminal');

// --- NEW: Banner Elements ---
const lightModeBanner = document.getElementById('lightModeBanner');
const darkModeBanner = document.getElementById('darkModeBanner');

// --- NEW: Mobile Tab Elements ---
const showEditorTab = document.getElementById('showEditorTab');
const showTerminalTab = document.getElementById('showTerminalTab');
const editorPanel = document.getElementById('editorPanel');
const terminalPanel = document.getElementById('terminalPanel');

// --- NEW: Line Highlight Element ---
const lineHighlight = document.getElementById('line-highlight');

let logData = "";
let currentLine = 0;
let programLines = [];
let variables = {};
let isRunning = false;
let lineMap = []; // <-- NEW: To map clean code lines to original editor lines

// --- Loop safety ---
let maxIterations = 1000000;
let iterationCount = 0;
let currentInputReject = null;

// keywords for highlighting
// --- *** UPDATED: Full keyword list from user *** ---
const keywords = [
  'START','BEGIN','STOP','END','DECLARE','INIT','INPUT','READ','GET','OUTPUT','PRINT',
  'DISPLAY', 'SET','LET','IF','THEN','ELSE','ELSEIF','ENDIF','FOR','TO','STEP','NEXT',
  'ENDFOR', 'WHILE','ENDWHILE','REPEAT','UNTIL','PROCEDURE','FUNCTION','CALL',
  'RETURN','ENDPROCEDURE','ENDFUNCTION', 'SWITCH', 'CASE', 'DEFAULT', 'ENDSWITCH',
  'CONSTANT', 'ARRAY', 'OF', 'LENGTH', 'FOREACH', 'BREAK', 'CONTINUE', 'COMMENT'
];

// --- Syntax Highlight ---
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;');
}

function updateHighlights() {
  const text = editor.value;
  let html = escapeHtml(text);
  let placeholders = [];

  // --- *** UPDATED: Separate string and char highlighting *** ---
  // 1. Store strings (double quotes) and replace with placeholders
  html = html.replace(/("(\\.|[^"\\])*")/g, (match) => {
    placeholders.push(`<span class="str">${match}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 2. Store chars (single quotes) and replace with placeholders
  html = html.replace(/('(\\.|[^'\\])*')/g, (match) => {
    placeholders.push(`<span class="char">${match}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });
  // --- *** END OF UPDATE *** ---


  // --- *** UPDATED: Store multi-line comments first *** ---
  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, (match) => {
    placeholders.push(`<span class="com">${escapeHtml(match)}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 3. Store single-line comments (now including # and --)
  // --- *** UPDATED: Removed single-quote from comment regex *** ---
  html = html.replace(/(\/\/.*$|#.*$|--.*$|\bCOMMENT\b.*$)/gm, (match) => {
    placeholders.push(`<span class="com">${escapeHtml(match)}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 4. Highlight keywords
  const keywordsRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'gi');
  html = html.replace(keywordsRegex, '<span class="kw">$1</span>');

  // 5. Highlight numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');

  // 6. Restore placeholders
  html = html.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
    return placeholders[index];
  });

  // 7. Set inner HTML
  highlight.innerHTML = '<div id="line-highlight"></div>' + html;
}

function updateLineNumbers() {
  const lineCount = editor.value.split('\n').length;
  lineGutter.textContent = Array.from({length: lineCount}, (_, i) => i + 1).join('\n');
}

// --- Line Highlight Logic ---
const EDITOR_LINE_HEIGHT = 14 * 1.6; // 14px font-size * 1.6 line-height

function highlightCurrentLine(lineIndex) {
    const activeLineHighlight = document.getElementById('line-highlight');
    if (!activeLineHighlight) return;
    // lineIndex is the 0-based index from the editor
    activeLineHighlight.style.top = `${lineIndex * EDITOR_LINE_HEIGHT}px`;
    activeLineHighlight.style.display = 'block';
}

function hideLineHighlight() {
    const activeLineHighlight = document.getElementById('line-highlight');
    if (activeLineHighlight) activeLineHighlight.style.display = 'none';
}
// --- END ---


function syncScroll(){
  highlight.scrollTop = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
  lineGutter.scrollTop = editor.scrollTop;
}

editor.addEventListener('input', ()=>{
  updateHighlights();
  updateLineNumbers();
  syncScroll();
  // --- NEW: Save code to localStorage on every input ---
  localStorage.setItem('pseudocodeLabCode', editor.value);
});
editor.addEventListener('scroll', syncScroll);

// --- *** UPDATED: Auto-indent & Auto-pairing *** ---
const indentUnit = '    ';
const pairs = {
  '(': ')',
  '"': '"',
  "'": "'",
  '[': ']',
  '{': '}'
};

editor.addEventListener('keydown', (e)=>{

  // --- NEW: Auto-pairing logic ---
  if (pairs.hasOwnProperty(e.key)) {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const opening = e.key;
    const closing = pairs[e.key];
    
    // Insert the pair
    editor.setRangeText(`${opening}${closing}`, start, end, 'end');
    
    // Move cursor back to be in the middle
    editor.selectionStart = start + 1;
    editor.selectionEnd = start + 1;
    
    updateHighlights();
    updateLineNumbers();
    syncScroll();
    return; // Stop here for this key
  }
  
  // --- NEW: Backspace logic for pairs ---
  if (e.key === 'Backspace' && editor.selectionStart === editor.selectionEnd) {
    const pos = editor.selectionStart;
    const charBefore = editor.value.substring(pos - 1, pos);
    const charAfter = editor.value.substring(pos, pos + 1);
    
    // Check if cursor is between an auto-paired set
    if (pairs[charBefore] === charAfter) {
      e.preventDefault();
      // Delete both characters
      editor.setRangeText('', pos - 1, pos + 1, 'end');
      updateHighlights();
      updateLineNumbers();
      syncScroll();
      return;
    }
  }

  // --- Existing Tab logic ---
  if(e.key === 'Tab'){
    e.preventDefault();
    const start = editor.selectionStart, end = editor.selectionEnd;
    if(!e.shiftKey){
      editor.setRangeText(indentUnit, start, end, 'end');
    } else {
      const lineStart = editor.value.lastIndexOf('\n', start-1)+1;
      if(editor.value.substring(lineStart, lineStart+indentUnit.length) === indentUnit){
        editor.setRangeText('', lineStart, lineStart+indentUnit.length, 'start');
      }
    }
    updateHighlights(); 
    updateLineNumbers(); 
    syncScroll();
    return;
  }

  // --- *** UPDATED: Existing Enter logic *** ---
  // --- *** ADDED !e.ctrlKey to prevent conflict with Run shortcut *** ---
  if(e.key === 'Enter' && !e.ctrlKey){
    const pos = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', pos-1)+1;
    const prevLine = editor.value.substring(lineStart, pos);
    const match = prevLine.match(/^(\s*)/);
    const curIndent = match ? match[1] : '';
    const trimmed = prevLine.trim().toUpperCase();
    
    // --- *** UPDATED: Added new keywords to auto-indent *** ---
    const increaseAfter = [
        'START','BEGIN','IF','FOR','WHILE','REPEAT','PROCEDURE','FUNCTION', 
        'SWITCH', 'CASE', 'DEFAULT'
    ];
    
    let newIndent = curIndent;
    for(const k of increaseAfter){ if(trimmed.startsWith(k) || trimmed.endsWith(k)) { newIndent = curIndent + indentUnit; break; } }
    
    setTimeout(()=>{
      const insertPos = editor.selectionStart;
      editor.setRangeText(newIndent, insertPos, insertPos, 'end');
      updateHighlights(); 
      updateLineNumbers();
      syncScroll();
    },0);
  }
});

// --- UPDATED: Keyup Listener (Auto-de-indent + Auto-uppercase) ---
editor.addEventListener('keyup', (e) => {
  
    // Don't run on keys that just move the cursor
    if (e.key && e.key.length > 1) {
        if (e.key.startsWith('Arrow') || e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab') {
             return;
        }
    }
    // Don't run for paired keys, as keydown already handled it
    if (pairs.hasOwnProperty(e.key)) {
        return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    let text = editor.value;
    let cursorOffset = 0;

    // --- 1. Auto-de-indent logic ---
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLineText = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
    const trimmedLine = currentLineText.trim().toUpperCase();
    
    // --- *** UPDATED: Added new keywords to de-indent *** ---
    const deindentKeywords = [
        'STOP','END','ENDIF','NEXT','ENDFOR','ENDWHILE','UNTIL','ENDPROCEDURE','ENDFUNCTION', 
        'ELSE', 'ELSEIF', 'CASE', 'DEFAULT', 'ENDSWITCH', 'BREAK'
    ];
    
    // --- FIX: Check if keyword is a prefix ---
    if (deindentKeywords.includes(trimmedLine)) {
        // Check if it's a prefix for another keyword in the list
        const isPrefix = deindentKeywords.some(kw => kw !== trimmedLine && kw.startsWith(trimmedLine));
        
        // Only de-indent if it's NOT a prefix and the line is indented
        if (!isPrefix && currentLineText.startsWith(indentUnit)) {
            text = text.substring(0, lineStart) + text.substring(lineStart + indentUnit.length);
            cursorOffset = -indentUnit.length; 
            
            editor.value = text;
            editor.selectionStart = Math.max(lineStart, start + cursorOffset);
            editor.selectionEnd = Math.max(lineStart, end + cursorOffset);
        }
    }
    // --- END FIX ---

    // --- 2. Auto-uppercase logic ---
    let currentText = editor.value;
    let upperStart = editor.selectionStart;
    let upperEnd = editor.selectionEnd;
    
    let placeholders = [];
    let tempText = currentText;

    // Store strings (supports escaped quotes)
    tempText = tempText.replace(/("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/g, (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });
    // Store multi-line comments
    tempText = tempText.replace(/(\/\*[\s\S]*?\*\/)/g, (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });
    // Store single-line comments
    // --- *** UPDATED: Removed single-quote from comment regex *** ---
    tempText = tempText.replace(/(\/\/.*$|#.*$|--.*$|\bCOMMENT\b.*$)/gm, (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });

    let changed = false;
    const keywordsRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'gi');
    
    tempText = tempText.replace(keywordsRegex, (match) => {
        const upper = match.toUpperCase();
        if (match !== upper) {
            changed = true;
            return upper;
        }
        return match;
    });

    tempText = tempText.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
        return placeholders[index];
    });
    
    if (changed && currentText !== tempText) {
        editor.value = tempText;
        editor.selectionStart = upperStart;
        editor.selectionEnd = upperEnd;
    }

    updateHighlights();
    updateLineNumbers();
});

// --- Terminal utilities ---
function appendLine(text, type = 'info'){
  const div = document.createElement('div');
  div.className = 'line';
  
  if (type === 'error') {
    div.style.color = '#f87171'; // red-400
    div.textContent = `${text}`;
  } else if (type === 'system') {
    div.style.color = '#60a5fa'; // blue-400
    div.textContent = `=== ${text} ===`;
  } else {
    // --- *** UPDATED: Convert all output to string *** ---
    div.textContent = String(text);
  }
  
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
  logData += div.textContent + "\n";
}

function appendInvisiblePrompt(callback){
  // --- ADD THESE ---
  let isResolved = false; // Prevents double-trigger
  const promiseReject = (reason) => {
    if (isResolved) return;
    isResolved = true;
    div.innerHTML = `[Input Canceled]`;
    div.style.color = '#f87171'; // red-400
    callback(new Error(reason)); // Reject the main promise
  };
  // --- END ADD ---

  const div = document.createElement('div');
  div.className = 'prompt';
  div.innerHTML = `<input type="text" class="input-field" autofocus>`;
  terminal.appendChild(div);
  const input = div.querySelector('input');
  input.focus();

  input.addEventListener('keydown', function onKey(e){
    if(e.key === 'Enter'){
      // --- ADD THESE CHECKS ---
      if (isResolved) return;
      isResolved = true;
      currentInputReject = null; // Clear the global rejector
      // --- END ADD ---

      const val = input.value;
      div.innerHTML = `${val}`; 
      div.style.color = '#34d399'; // green-400
      logData += '> ' + val + "\n";
      input.removeEventListener('keydown', onKey);
      callback(val); // Resolve the main promise
    }
  });

  // --- SET THE GLOBAL REJECTOR ---
  currentInputReject = () => promiseReject("Execution Stopped");
  // --- END SET ---

  terminal.scrollTop = terminal.scrollHeight;
}

clearTerminalBtn.addEventListener('click', ()=>{
  terminal.innerHTML = '';
  logData = '';
});

// --- Interpreter Core ---

// --- *** UPDATED FUNCTION *** ---
// This function now strips comments and returns the clean code
function preprocessAndValidate(code) {
  
  // --- *** NEW: Remove multi-line comments first *** ---
  let cleanCode = code.replace(/\/\*[\s\S]*?\*\//g, '');

  const allLines = cleanCode.split('\n');
  const cleanProgramLines = []; // This will hold the clean code
  const newLineMap = []; // Maps clean line index to original line number

  for (let i = 0; i < allLines.length; i++) {
    let line = allLines[i];
    
    // Find comment markers
    const commentIndex1 = line.indexOf('//');
    // --- *** UPDATED: Removed single-quote comment check *** ---
    // const commentIndex2 = line.indexOf("'"); 
    const commentIndex3 = line.indexOf("#"); // NEW
    const commentIndex4 = line.indexOf("--"); // NEW
    // --- *** NEW: Find COMMENT keyword *** ---
    const commentIndex5 = line.toUpperCase().indexOf("COMMENT");

    let commentIndex = -1;

    // Find the first comment marker
    // --- *** UPDATED: Removed commentIndex2 *** ---
    const indices = [commentIndex1, commentIndex3, commentIndex4]
                      .filter(index => index !== -1);
    
    // Handle keyword comment separately
    if (commentIndex5 === 0) {
        line = ""; // Treat the whole line as a comment
    } else if (indices.length > 0) {
      commentIndex = Math.min(...indices);
      line = line.substring(0, commentIndex);
    }

    const trimmedLine = line.trim();
    
    // Only push non-empty, trimmed lines
    if (trimmedLine) {
      cleanProgramLines.push(trimmedLine); // Push the *clean, trimmed* line
      newLineMap.push(i + 1); // Store original 1-based line number
    }
  }
  // --- END OF FIX ---

  if (cleanProgramLines.length === 0) {
    throw new Error("Code is empty or only contains comments.");
  }

  const firstLine = cleanProgramLines[0].toUpperCase();
  if (!firstLine.startsWith('START') && !firstLine.startsWith('BEGIN')) {
    throw new Error(`Code must begin with START or BEGIN. (Found: "${cleanProgramLines[0]}" on line ${newLineMap[0]})`);
  }

  const lastLine = cleanProgramLines[cleanProgramLines.length - 1].toUpperCase();
  if (!lastLine.startsWith('STOP') && !lastLine.startsWith('END')) {
    throw new Error(`Code must end with STOP or END. (Found: "${cleanProgramLines[cleanProgramLines.length - 1]}" on line ${newLineMap[cleanProgramLines.length - 1]})`);
  }

  // --- *** UPDATED RETURN *** ---
  // Return the clean lines and the map
  return { cleanLines: cleanProgramLines, originalLineMap: newLineMap };
}


// --- *** UPDATED FUNCTION *** ---
// This function now uses the lineMap for errors and highlighting
async function executeNextLine(controlStack) {
    
    // --- 1. Check if program should stop ---
    if (!isRunning) return false;
    
    // --- *** UPDATED: No more while loop needed *** ---
    // programLines is now a clean list, so we just check the bounds.
    if (currentLine >= programLines.length) {
        const lastLineNum = lineMap.length > 0 ? lineMap[lineMap.length - 1] : 0;
        appendLine(`Error: Code finished without STOP or END command. Last processed line was ${lastLineNum}.`, "error");
        isRunning = false;
        hideLineHighlight();
        return false;
    }

    // --- *** UPDATED: Highlight current line *** ---
    // Use the lineMap to find the *original* editor line index
    const originalLineIndex = lineMap[currentLine] - 1;
    highlightCurrentLine(originalLineIndex);

    // Check for infinite loop
    iterationCount++;
    if (iterationCount > maxIterations) {
        appendLine(`Error: Potential infinite loop detected (exceeded 1,000,000 operations).`, "error");
        isRunning = false;
        hideLineHighlight();
        return false;
    }

    // --- 2. Get current line and skip state ---
    // No .trim() needed, programLines is already clean
    const trimmed = programLines[currentLine];
    const line = trimmed.toUpperCase();
    
    // --- *** BUG FIX: RE-WRITTEN SKIP LOGIC *** ---
    let shouldSkip = false;
    if (controlStack.length > 0) {
      const top = controlStack[controlStack.length - 1];

      if (top.type === 'SWITCH') {
        if (top.isSkipping) {
            shouldSkip = true; // We've hit a BREAK, skip everything
        } else if (!top.hasMatch) {
            shouldSkip = true; // No match yet, skip
        } else {
            shouldSkip = false; // We have a match and are falling-through
        }
      } else if (top.hasOwnProperty('skip')) { // Check for IF/LOOP
        shouldSkip = top.skip;
      }
    }
    // --- *** END OF BUG FIX *** ---
    
    try { 
    
      // --- 3. Handle Control Flow (always, even if skipping) ---
      
      // --- *** NEW: Handle COMMENT keyword *** ---
      if (line.startsWith('COMMENT')) {
          currentLine++;
          return true;
      }
      
      // --- *** UPDATED: Handle ELSE IF two-word variant *** ---
      if(line.startsWith('IF')){
        if (shouldSkip) {
          controlStack.push({ type: 'IF', skip: true, executed: false });
        } else {
          const condition = trimmed.replace(/^IF/i,'').replace(/THEN$/i,'').trim();
          if (!condition) throw new Error("IF statement has no condition.");
          const conditionResult = evalExpr(condition);
          controlStack.push({ type: 'IF', skip: !conditionResult, executed: conditionResult });
        }
        currentLine++;
        return true;
      }
      
      if(line.startsWith('ELSEIF') || line.startsWith('ELSE IF')){
        const top = controlStack[controlStack.length - 1];
        if (!top || top.type !== 'IF') { throw new Error("ELSEIF without matching IF."); }
        
        if (top.executed) {
          top.skip = true;
        } else if (!top.executed) {
          // --- *** UPDATED: Handle two-word variant *** ---
          const condition = trimmed.replace(/^ELSEIF/i,'').replace(/^ELSE IF/i,'').replace(/THEN$/i,'').trim();
          if (!condition) throw new Error("ELSEIF statement has no condition.");
          const conditionResult = evalExpr(condition);
          if (conditionResult) {
            top.executed = true;
            top.skip = false;
          } else {
            top.skip = true;
          }
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('ELSE')){
        const top = controlStack[controlStack.length - 1];
        if (!top || top.type !== 'IF') { throw new Error("ELSE without matching IF."); }
        
        if (top.executed) {
          top.skip = true;
        } else {
          top.skip = false;
          top.executed = true;
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('ENDIF')){
        if (controlStack.length === 0 || controlStack[controlStack.length - 1].type !== 'IF') {
           throw new Error("ENDIF without matching IF.");
        }
        controlStack.pop();
        currentLine++;
        return true;
      }

      // --- 4. Handle Loop Flow (always, even if skipping) ---
      if(line.startsWith('FOR')){
        if (shouldSkip) {
            controlStack.push({ type: 'LOOP_SKIP', skip: true });
        } else {
            const m = trimmed.match(/^FOR\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
            if(!m) { throw new Error("Invalid FOR loop syntax. Expected: FOR var = start TO end [STEP val]"); }
            const name = m[1];
            if (!variables.hasOwnProperty(name)) { throw new Error(`Variable "${name}" not DECLARED before use in FOR loop.`); }
            const startVal = evalExpr(m[2]);
            const endVal = evalExpr(m[3]);
            const step = m[4] ? evalExpr(m[4]) : 1;
            if (step === 0) throw new Error("FOR loop STEP cannot be zero.");
            variables[name] = startVal;
            const cond = (step > 0) ? (variables[name] <= endVal) : (variables[name] >= endVal);
            if(cond) {
              controlStack.push({type:'FOR', var:name, end:endVal, step:step, startLine: currentLine, skip: false, broken: false});
            } else {
              controlStack.push({ type: 'LOOP_SKIP', skip: true });
            }
        }
        currentLine++;
        return true;
      }

      // --- *** UPDATED: Added ENDFOR *** ---
      if(line.startsWith('NEXT') || line.startsWith('ENDFOR')){
        const top = controlStack[controlStack.length - 1];
        if(!top || (top.type !== 'FOR' && top.type !== 'LOOP_SKIP')) { throw new Error("NEXT/ENDFOR without matching FOR loop."); }

        if (top.type === 'LOOP_SKIP' || top.broken) { // --- NEW: Check for broken flag
          controlStack.pop();
        } else {
          variables[top.var] = variables[top.var] + top.step;
          const cond = (top.step > 0) ? (variables[top.var] <= top.end) : (variables[top.var] >= top.end);
          if(cond){
            currentLine = top.startLine + 1;
            return true; // Loop back
          } else {
            controlStack.pop();
          }
        }
        currentLine++;
        return true;
      }
      
      if(line.startsWith('WHILE')){
        const top = (controlStack.length > 0) ? controlStack[controlStack.length - 1] : null;
        if (top && top.type === 'WHILE' && top.startLine === currentLine) {
            // Re-evaluating
            const cond = evalExpr(top.condExpr);
            top.skip = !cond;
        } else {
            // First time
            const condExpr = trimmed.replace(/^WHILE/i,'').replace(/DO$/i,'').trim();
            if (!condExpr) throw new Error("WHILE statement has no condition.");
            const cond = evalExpr(condExpr);
            controlStack.push({type:'WHILE', condExpr:condExpr, startLine: currentLine, skip: !cond, broken: false});
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('ENDWHILE')){
        const top = controlStack[controlStack.length - 1];
        if(!top || top.type !== 'WHILE') { throw new Error("ENDWHILE without matching WHILE loop."); }
        
        if (top.skip === true || top.broken) { // --- NEW: Check for broken flag
          controlStack.pop();
        } else {
          currentLine = top.startLine; // Jump back to WHILE
          return true;
        }
        currentLine++;
        return true;
      }
      
      if(line.startsWith('REPEAT')){
        if (shouldSkip) {
            controlStack.push({ type: 'LOOP_SKIP', skip: true });
        } else {
            controlStack.push({type:'REPEAT', startLine: currentLine, skip: false, broken: false});
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('UNTIL')){
        const top = controlStack[controlStack.length - 1];
        if(!top || (top.type !== 'REPEAT' && top.type !== 'LOOP_SKIP')) { throw new Error("UNTIL without matching REPEAT loop."); }

        if (top.type === 'LOOP_SKIP' || top.broken) { // --- NEW: Check for broken flag
            controlStack.pop();
        } else {
            const condExpr = trimmed.replace(/^UNTIL/i,'').trim();
            if (!condExpr) throw new Error("UNTIL statement has no condition.");
            const cond = evalExpr(condExpr);
            if(!cond){
              currentLine = top.startLine + 1; // Go to line after REPEAT
              return true;
            } else {
              controlStack.pop();
            }
        }
        currentLine++;
        return true;
      }

      // --- *** UPDATED: C-Style SWITCH Flow (always) *** ---
      if(line.startsWith('SWITCH')){
        if (shouldSkip) {
            controlStack.push({ type: 'SWITCH_SKIP', skip: true });
        } else {
            const m = trimmed.match(/^SWITCH\s*\((.+)\)$/i);
            if (!m) throw new Error("Invalid SWITCH syntax. Expected: SWITCH (expression)");
            const val = evalExpr(m[1]);
            controlStack.push({ type: 'SWITCH', switchValue: val, hasMatch: false, isSkipping: false });
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('CASE')){
        const top = controlStack[controlStack.length - 1];
        if (!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) {
            throw new Error("CASE without matching SWITCH.");
        }
        
        if (top.type === 'SWITCH_SKIP') {
            // This whole switch block is skipped, do nothing
        } else if (top.isSkipping) {
            // We've hit a break, do nothing
        } else {
            const m = trimmed.match(/^CASE\s+(.+):$/i);
            if (!m) throw new Error("Invalid CASE syntax. Expected: CASE value:");
            
            if (top.hasMatch) {
                // We are in fall-through mode, so we run
            } else {
                const caseVal = evalExpr(m[1]);
                if (caseVal === top.switchValue) {
                    top.hasMatch = true;
                }
            }
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('DEFAULT')){
        const top = controlStack[controlStack.length - 1];
        if (!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) {
            throw new Error("DEFAULT without matching SWITCH.");
        }
        if (top.type === 'SWITCH_SKIP') {
            // block is skipped
        } else if (top.isSkipping) {
             // We've hit a break, do nothing
        } else {
            if (!top.hasMatch) {
                top.hasMatch = true; // This is now the matching block
            }
        }
        currentLine++;
        return true;
      }
      
      // --- *** BUG FIX: BREAK LOGIC *** ---
      if(line.startsWith('BREAK')) {
        
        // --- *** THIS IS THE FIX *** ---
        // If we are supposed to be skipping, just skip this line.
        // The *only* time BREAK should run is if `shouldSkip` is false.
        if (shouldSkip) {
            currentLine++;
            return true;
        }
        // --- *** END OF FIX *** ---

        // If we are not skipping, then this BREAK is "live" and should run.
        let i = controlStack.length - 1;
        while(i >= 0) {
            const block = controlStack[i];
            if (block.type === 'SWITCH') {
                block.isSkipping = true; // Tell SWITCH to skip remaining lines
                break;
            }
            if (block.type === 'FOR' || block.type === 'WHILE' || block.type === 'REPEAT') {
                block.broken = true; // Tell loop END to not loop
                block.skip = true; // Tell interpreter to skip lines
                break;
            }
            i--;
        }
        if (i < 0) throw new Error("BREAK outside of loop or SWITCH block.");
        
        currentLine++;
        return true;
      }
      // --- *** END OF BUG FIX *** ---

      if(line.startsWith('ENDSWITCH')){
        const top = controlStack[controlStack.length - 1];
        if (!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) {
            throw new Error("ENDSWITCH without matching SWITCH.");
        }
        controlStack.pop();
        currentLine++;
        return true;
      }
      // --- *** END OF SWITCH/BREAK LOGIC *** ---


      // --- 5. Handle normal commands (only if not skipping) ---
      if (shouldSkip) {
        currentLine++;
        return true; // Skip and continue
      }
      
      if(line.startsWith('START') || line.startsWith('BEGIN')){
        currentLine++;
        return true;
      }

      if(line.startsWith('STOP') || line.startsWith('END')){
        appendLine(" ");
        appendLine("Code Execution Successful", "system");
        isRunning = false;
        hideLineHighlight();
        return false; // Stop execution
      }
      
      // --- *** UPDATED: Added CONSTANT *** ---
      if(line.startsWith('DECLARE') || line.startsWith('INIT') || line.startsWith('CONSTANT')){
        // Note: CONSTANT is not truly enforced, treated as DECLARE
        const lineAfterKeyword = trimmed.replace(/^(?:DECLARE|INIT|CONSTANT)\s+/i, '');
        
        // --- *** UPDATED REGEX (FIX) *** ---
        // This regex splits by comma, but ignores commas inside quotes.
        const parts = lineAfterKeyword.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
  
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart) continue;
  
            let varName = "";
            let varValue = null;
  
            if (trimmedPart.includes('=')) {
                // This is an initialization (e.g., "name = 10")
                
                // --- *** BUG FIX FROM USER *** ---
                // --- NEW ROBUST SPLIT LOGIC ---
                const eqIndex = trimmedPart.indexOf('=');
                varName = trimmedPart.substring(0, eqIndex).trim();
                const expression = trimmedPart.substring(eqIndex + 1).trim();
                
                if (!expression) { // Check if expression is empty
                    throw new Error(`Missing value in assignment for "${varName}".`);
                }
                // --- END BUG FIX ---

                varValue = evalExpr(expression);
  
            } else {
                // This is a simple declaration (e.g., "myVar")
                varName = trimmedPart;
                varValue = null;
            }
  
            if (!varName) {
                throw new Error(`Invalid declaration syntax: "${trimmedPart}".`);
            }
            if (variables.hasOwnProperty(varName)) {
                throw new Error(`Variable "${varName}" is already declared.`);
            }
            if (!/^[a-zA-Z_]\w*$/.test(varName)) {
                throw new Error(`Invalid variable name: "${varName}".`);
            }
            
            variables[varName] = varValue;
        }
        
        currentLine++;
        return true;
      }

      // --- *** UPDATED: Added DISPLAY *** ---
      if(line.startsWith('OUTPUT') || line.startsWith('PRINT') || line.startsWith('DISPLAY')){
        const rest = trimmed.replace(/^(?:OUTPUT|PRINT|DISPLAY)\s+/i,'');

        // --- *** UPDATED REGEX (FIX) *** ---
        // This regex splits by comma, but ignores commas inside quotes.
        const parts = rest.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
        
        let outputString = "";
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart) {
                
                // --- *** THIS IS THE CHANGE (Decimal Formatting) *** ---
                let value = evalExpr(trimmedPart);
                
                // Check if the value is a number and has decimal places
                if (typeof value === 'number' && !Number.isInteger(value)) {
                    // Format to 2 decimal places
                    value = value.toFixed(2);
                }
                
                outputString += value; 
                // --- *** END OF CHANGE *** ---
            }
        }
        appendLine(outputString);
        currentLine++;
        return true;
      }

      // --- *** UPDATED: Added READ, GET *** ---
      if(line.startsWith('INPUT') || line.startsWith('READ') || line.startsWith('GET')){
        const rest = trimmed.replace(/^(?:INPUT|READ|GET)\s+/i,'');
        const parts = rest.split(',');
        const varName = parts.pop().trim();
        
        if (!variables.hasOwnProperty(varName)) { throw new Error(`Variable "${varName}" not DECLARED before use in INPUT.`); }
        
        const promptText = parts.join(',').trim();
        if (promptText) { appendLine(evalExpr(promptText)); }

        // --- REPLACE THE OLD AWAIT WITH THIS PROMISE ---
        const val = await new Promise((resolve, reject) => {
          appendInvisiblePrompt((value) => {
            if (value instanceof Error) {
              reject(value); // This will be the "Execution Stopped" error
            } else {
              resolve(value);
            }
          });
        });
        // --- END REPLACEMENT ---

        // This code will NOT run if the promise was rejected
        const numeric = (val !== '' && !isNaN(val) && val.trim() !== '');
        variables[varName] = numeric ? parseFloat(val) : val;
        
        currentLine++;
        return true;
      }

      const assignMatch = trimmed.match(/^(?:SET|LET)?\s*([a-zA-Z_]\w*)\s*=\s*(.*)$/i);
      if(assignMatch && !line.startsWith('IF') && !line.startsWith('FOR') && !line.startsWith('WHILE')){
        const name = assignMatch[1];
        const expr = assignMatch[2];
        
        if (!variables.hasOwnProperty(name)) { throw new Error(`Variable "${name}" not DECLARED before use.`); }
        if (!expr) throw new Error("Assignment has no expression.");
        
        variables[name] = evalExpr(expr);
        currentLine++;
        return true;
      }

      // --- 6. Unhandled ---
      // --- *** NEW: Check for unimplemented keywords *** ---
      if (line.startsWith('FUNCTION') || line.startsWith('PROCEDURE') || line.startsWith('ARRAY') || line.startsWith('CONTINUE')) {
          throw new Error(`"${line.split(' ')[0]}" is a valid keyword, but is not implemented in this interpreter yet.`);
      }
      
      throw new Error(`Unknown or invalid syntax: "${trimmed}"`);
    
    } catch (error) { // --- *** THIS IS THE BLOCK TO EDIT *** ---
        
        // --- ADD THIS "IF" CHECK ---
        if (error.message === "Execution Stopped") {
            // This was a user-triggered stop.
            // The stop button already printed the message.
            // We just need to stop the loop.
            isRunning = false;
            hideLineHighlight();
            return false;
        }
        // --- END OF ADDITION ---

        // If it's any OTHER error, report it as normal:
        appendLine(`Error on line ${lineMap[currentLine]}: ${error.message}`, 'error');
        isRunning = false;
        hideLineHighlight();
        return false;
    }
}


// --- runProgram() ---
// --- runProgram() ---
async function runProgram() {
    const controlStack = []; // Stack for IF/LOOP logic
    
    try {
      while (isRunning) {
          const continueRunning = await executeNextLine(controlStack);
          if (!continueRunning) {
              break; // Program finished or error
          }
          
          // --- NEW: When running, switch to terminal tab on mobile ---
          if (window.innerWidth < 1024 && terminalPanel.classList.contains('hidden')) {
              showTerminalTab.click();
          }

          // Yield to the event loop
          await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (e) { 
        // --- UPDATE THIS CATCH BLOCK ---
        if (e.message === "Execution Stopped") {
          // This is a normal, user-triggered stop. Do nothing.
          // The stop button already printed the message.
        } else {
          // This is a real, unexpected error
          appendLine(`Fatal Error: ${e.message}`, 'error');
        }
        isRunning = false; // Ensure this is set on error
        // --- END UPDATE ---
    } finally { 
        // This runs whether the code finished, stopped, or errored
        // --- THIS IS THE CRITICAL PART ---
        setControls(false); // ALWAYS re-enable controls
        currentInputReject = null; // Clear any leftover rejector
    }
}


// --- UPDATED: evalExpr (LOGIC FIX) ---
function evalExpr(expr) {
  if (expr === undefined || expr === null) return undefined;

  // 1. Check if the expression is a simple string literal (supports escaped quotes)
  const stringMatch = expr.match(/^"((?:\\.|[^"\\])*)"$/);
  if (stringMatch) {
    // It's a simple string. Unescape it and return.
    return stringMatch[1].replace(/\\(.)/g, '$1');
  }
  const stringMatch2 = expr.match(/^'((?:\\.|[^'\\])*)'$/);
  if (stringMatch2) {
    // It's a simple string. Unescape it and return.
    return stringMatch2[1].replace(/\\(.)/g, '$1');
  }

  // 2. It's not a simple string. It's a variable or a complex expression.
  let placeholders = [];
  let tempExpr = expr;

  // Store strings and replace with placeholders (supports escaped quotes)
  tempExpr = tempExpr.replace(/("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/g, (match) => {
    placeholders.push(match);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // Replace variables
  tempExpr = tempExpr.replace(/\b([A-Za-z_]\w*)\b/g, (m) => {
    if (variables.hasOwnProperty(m)) {
      const val = variables[m];

      // --- *** THIS IS THE CHANGE *** ---
      // Old line that caused the error:
      // if (val === null) throw new Error(`Variable "${m}" was DECLARESRED but not given a value.`);
      
      // New line: Treat uninitialized variables as the value 'null'
      if (val === null) return null;
      // --- *** END OF CHANGE *** ---

      if (typeof val === 'string') return JSON.stringify(val); // Add quotes back
      return String(val);
    }
    if (/^(TRUE|FALSE|null)$/i.test(m)) return m.toLowerCase();
    return m;
  });

  // --- *** UPDATED: New operators *** ---
  // Replace pseudocode operators with JS operators
  tempExpr = tempExpr.replace(/\bAND\b/gi, '&&')
                     .replace(/\bOR\b/gi, '||')
                     .replace(/\bNOT\b/gi, '!')
                     .replace(/&&/g, '&&') // Handle C-style
                     .replace(/\|\|/g, '||') // Handle C-style
                     .replace(/(?<![<>=!])!/g, '!')   // Handle C-style NOT
                     .replace(/\bDIV\b/gi, 'Math.floor')
                     .replace(/\bMOD\b/gi, '%')
                     .replace(/(?<!\d)%(?!\d)/g, '%') // Handle C-style MOD
                     .replace(/\^/g, '**') // Handle C-style Exponent
                     .replace(/==/g, '===') // Handle C-style
                     .replace(/<>/g, '!==')
                     .replace(/!=/g, '!==') // Handle C-style
                     .replace(/(?<![=!<>])=(?!=)/g, '==='); // Keep original single = comparison

  // Restore placeholders
  tempExpr = tempExpr.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
    return placeholders[index];
  });

  // 3. Evaluate the final JS expression
  try {
    return Function(`"use strict"; return (${tempExpr});`)();
  } catch (e) {
    throw new Error(`Invalid expression "${expr}". Failed to evaluate: ${e.message}`);
  }
}

// --- *** UPDATED FUNCTION *** ---
// This function now correctly handles the clean code and map
// --- *** UPDATED FUNCTION *** ---
// This function now correctly handles the clean code and map
function startRun() {
    terminal.innerHTML = '';
    logData = '';
    hideLineHighlight();

    // --- ADD THIS LINE AT THE TOP ---
    setControls(true); // Disable controls, show spinner

    try {
        // --- *** UPDATED: Get the clean lines and map *** ---
        const { cleanLines, originalLineMap } = preprocessAndValidate(editor.value);
        
        programLines = cleanLines; // Assign CLEAN lines to global
        lineMap = originalLineMap; // Assign the map to global
        
        variables = {};
        currentLine = 0;
        iterationCount = 0; // Reset iteration count
        isRunning = true;
        controlStack = []; // Reset control stack
        
        runProgram(); // Auto-start the async runner

    } catch (error) {
        appendLine(error.message, 'error');
        isRunning = false;
        hideLineHighlight();
        // --- ADD THIS LINE FOR ERROR CASE ---
        setControls(false); // Re-enable controls
    }
}

runBtn.addEventListener('click', () => startRun());

stopBtn.addEventListener('click', ()=>{
  if(isRunning){
    isRunning = false;
    hideLineHighlight();
    appendLine("Execution Stopped", "system");

    // --- ADD THIS LOGIC ---
    // This is the "interrupt"
    if (currentInputReject) {
      currentInputReject();
      currentInputReject = null; // Clear it
    }
    // --- END ADD ---
  }
});

// --- *** NEW: Save Button Logic *** ---
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const code = editor.value;
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pseudocode.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    appendLine("Code saved to pseudocode.txt", "system");
  });
}

// --- ADD THIS NEW FUNCTION ---
function setControls(running) {
  if (running) {
    runBtn.disabled = true;
    runBtn.classList.add('is-running');
    stopBtn.disabled = false;
    resetBtn.disabled = true; // Also disable reset
  } else {
    runBtn.disabled = false;
    runBtn.classList.remove('is-running');
    stopBtn.disabled = true; // Disable stop when not running
    resetBtn.disabled = false;
  }
}
// --- END OF NEW FUNCTION ---

// restartBtn listener removed

// restartBtn listener removed

// --- DARK MODE + KEYBOARD ---
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

function setTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  if (sunIcon && moonIcon) {
    sunIcon.classList.toggle('hidden', !dark);
    moonIcon.classList.toggle('hidden', dark);
  }

  // --- THIS IS THE NEW LOGIC ---
  // This will run when the page loads AND when the button is clicked.
  if (lightModeBanner && darkModeBanner) {
    if (dark) {
      // DARK MODE
      lightModeBanner.classList.add('hidden');
      darkModeBanner.classList.remove('hidden');
    } else {
      // LIGHT MODE
      lightModeBanner.classList.remove('hidden');
      darkModeBanner.classList.add('hidden');
    }
  }
}

// Check for saved theme
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) {
    setTheme(savedTheme === 'dark');
} else {
    setTheme(prefersDark);
}

// Handle theme toggle click
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        setTheme(!document.documentElement.classList.contains('dark'));
    });
}


editor.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('runBtn').click();
  }
});

// --- NEW: Mobile Tab Logic ---
if (showEditorTab) {
  showEditorTab.addEventListener('click', () => {
    // Show editor, hide terminal
    editorPanel.classList.remove('hidden');
    terminalPanel.classList.add('hidden');
    
    // Style tabs
    showEditorTab.classList.add('text-text-primary', 'border-accent');
    showEditorTab.classList.remove('text-text-secondary', 'border-transparent');
    showTerminalTab.classList.add('text-text-secondary', 'border-transparent');
    showTerminalTab.classList.remove('text-text-primary', 'border-accent');
  });
}

if (showTerminalTab) {
  showTerminalTab.addEventListener('click', () => {
    // Show terminal, hide editor
    terminalPanel.classList.remove('hidden');
    editorPanel.classList.add('hidden');
    
    // Style tabs
    showTerminalTab.classList.add('text-text-primary', 'border-accent');
    showTerminalTab.classList.remove('text-text-secondary', 'border-transparent');
    showEditorTab.classList.add('text-text-secondary', 'border-transparent');
    showEditorTab.classList.remove('text-text-primary', 'border-accent');
  });
}

// --- *** NEW: Default Code and Reset Logic *** ---
const defaultCode = `START
    
    // Welcome to PseudoPlay!

    DECLARE name
    PRINT "Enter your name"
    GET name
    PRINT "Hello, " + name + "!"
    
STOP`;

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    // Reset to default code
    editor.value = defaultCode;
    // Also reset the saved code in localStorage
    localStorage.setItem('pseudocodeLabCode', defaultCode);
    // Update editor UI
    updateHighlights();
    updateLineNumbers();
    syncScroll();
    appendLine("Editor reset to default code.", "system");
  });
}


// --- Initialize ---
// Load saved code from localStorage
const savedCode = localStorage.getItem('pseudocodeLabCode');
if (savedCode) {
  editor.value = savedCode;
} else {
  // --- NEW: Load default code if no save exists ---
  editor.value = defaultCode;
}

updateHighlights();
updateLineNumbers();
appendLine("PseudoPlay Ready.", "system");

// --- ADD THIS LINE ---
setControls(false); // Set initial button state




