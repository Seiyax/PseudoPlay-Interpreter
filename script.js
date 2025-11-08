// --- ELEMENTS ---
const editor = document.getElementById('editor');
const highlight = document.getElementById('highlight');
const lineGutter = document.getElementById('line-gutter');
const terminal = document.getElementById('terminal');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');
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
let lineMap = []; // To map clean code lines to original editor lines
// --- REMOVED: let jumpMap = {}; ---

// --- Loop safety ---
let maxIterations = 1000000;
let iterationCount = 0;
let currentInputReject = null;
let outputLineCount = 0; // <-- ADD THIS
const MAX_OUTPUT_LINES = 1000000; // <-- ADD THIS (you can change this value)

// keywords for highlighting
const keywords = [
  'START','BEGIN','STOP','END','DECLARE','INIT','INPUT','READ','GET','OUTPUT','PRINT',
  'DISPLAY', 'SET','LET','IF','THEN','ELSE','ELSEIF','ENDIF','FOR','TO','STEP','NEXT',
  'ENDFOR', 'WHILE','ENDWHILE','REPEAT','UNTIL','PROCEDURE','FUNCTION','CALL',
  'RETURN','ENDPROCEDURE','ENDFUNCTION', 'SWITCH', 'CASE', 'DEFAULT', 'ENDSWITCH',
  'CONSTANT', 'ARRAY', 'OF', 'LENGTH', 'FOREACH', 'BREAK', 'CONTINUE', 'COMMENT',
  'AND', 'OR', 'NOT'
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

  // 1. Store strings (double quotes)
  html = html.replace(/("(\\.|[^"\\])*")/g, (match) => {
    placeholders.push(`<span class="str">${match}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 2. Store chars (single quotes)
  html = html.replace(/('(\\.|[^'\\])*')/g, (match) => {
    placeholders.push(`<span class="char">${match}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 3. Store multi-line comments
  html = html.replace(/\/\*.*?\*\//gs, (match) => {
    placeholders.push(`<span class="com">${escapeHtml(match)}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 4. Store single-line comments
  html = html.replace(/(\/\/.*$|#.*$|--.*$|\bCOMMENT\b.*$)/gm, (match) => {
    placeholders.push(`<span class="com">${escapeHtml(match)}</span>`);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // 5. Highlight keywords
  const keywordsRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'gi');
  html = html.replace(keywordsRegex, '<span class="kw">$1</span>');

  // 6. Highlight numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');

  // 7. Highlight C-style logical operators (must look for escaped '&amp;')
  html = html.replace(/(&amp;&amp;|\|\||(?<![<>=!])!)/g, '<span class="kw">$1</span>');

  // 8. Restore placeholders
  html = html.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
    return placeholders[index];
  });

  // 9. Set inner HTML
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
  localStorage.setItem('pseudocodeLabCode', editor.value);
});
editor.addEventListener('scroll', syncScroll);

// --- Auto-indent & Auto-pairing ---
const indentUnit = '    ';
const pairs = {
  '(': ')',
  '"': '"',
  "'": "'",
  '[': ']',
  '{': '}'
};

editor.addEventListener('keydown', (e)=>{

  if (pairs.hasOwnProperty(e.key)) {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const opening = e.key;
    const closing = pairs[e.key];
    editor.setRangeText(`${opening}${closing}`, start, end, 'end');
    editor.selectionStart = start + 1;
    editor.selectionEnd = start + 1;
    updateHighlights();
    updateLineNumbers();
    syncScroll();
    return;
  }
  
  if (e.key === 'Backspace' && editor.selectionStart === editor.selectionEnd) {
    const pos = editor.selectionStart;
    const charBefore = editor.value.substring(pos - 1, pos);
    const charAfter = editor.value.substring(pos, pos + 1);
    
    if (pairs[charBefore] === charAfter) {
      e.preventDefault();
      editor.setRangeText('', pos - 1, pos + 1, 'end');
      updateHighlights();
      updateLineNumbers();
      syncScroll();
      return;
    }
  }

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

  if(e.key === 'Enter' && !e.ctrlKey){
    const pos = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf('\n', pos-1)+1;
    const prevLine = editor.value.substring(lineStart, pos);
    const match = prevLine.match(/^(\s*)/);
    const curIndent = match ? match[1] : '';
    const trimmed = prevLine.trim().toUpperCase();
    
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

// --- Auto-de-indent & Auto-uppercase ---
editor.addEventListener('keyup', (e) => {
  
    if (e.key && e.key.length > 1) {
        if (e.key.startsWith('Arrow') || e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab') {
             return;
        }
    }
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
    
    const deindentKeywords = [
        'STOP','END','ENDIF','NEXT','ENDFOR','ENDWHILE','UNTIL','ENDPROCEDURE','ENDFUNCTION', 
        'ELSE', 'ELSEIF', 'CASE', 'DEFAULT', 'ENDSWITCH', 'BREAK'
    ];
    
    if (deindentKeywords.includes(trimmedLine)) {
        const isPrefix = deindentKeywords.some(kw => kw !== trimmedLine && kw.startsWith(trimmedLine));
        
        if (!isPrefix && currentLineText.startsWith(indentUnit)) {
            text = text.substring(0, lineStart) + text.substring(lineStart + indentUnit.length);
            cursorOffset = -indentUnit.length; 
            
            editor.value = text;
            editor.selectionStart = Math.max(lineStart, start + cursorOffset);
            editor.selectionEnd = Math.max(lineStart, end + cursorOffset);
        }
    }

    // --- 2. Auto-uppercase logic ---
    let currentText = editor.value;
    let upperStart = editor.selectionStart;
    let upperEnd = editor.selectionEnd;
    
    let placeholders = [];
    let tempText = currentText;

    tempText = tempText.replace(/("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/g, (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });
    tempText = tempText.replace(/\/\*.*?\*\//gs, (match) => { 
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });
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
  // --- THIS IS THE OUTPUT LIMIT FIX ---
  if (type === 'info') {
    outputLineCount++;
    if (outputLineCount > MAX_OUTPUT_LINES) {
        if (outputLineCount === MAX_OUTPUT_LINES + 1) {
            throw new Error(`Output limit of ${MAX_OUTPUT_LINES} lines reached. Execution halted.`);
        }
        return; // Stop appending
    }
  }
  // --- END OF FIX ---

  const div = document.createElement('div');
  div.className = 'line';
  
  if (type === 'error') {
    div.style.color = '#f87171'; // red-400
    div.textContent = `${text}`;
  } else if (type === 'system') {
    div.style.color = '#60a5fa'; // blue-400
    div.textContent = `=== ${text} ===`;
  } else {
    div.textContent = String(text);
  }
  
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight;
  logData += div.textContent + "\n";
}

function appendInvisiblePrompt(callback){
  let isResolved = false; 
  const promiseReject = (reason) => {
    if (isResolved) return;
    isResolved = true;
    div.innerHTML = `[Input Canceled]`;
    div.style.color = '#f87171';
    callback(new Error(reason)); 
  };

  const div = document.createElement('div');
  div.className = 'prompt';
  div.innerHTML = `<input type="text" class="input-field" autofocus>`;
  terminal.appendChild(div);
  const input = div.querySelector('input');
  input.focus();

  input.addEventListener('keydown', function onKey(e){
    if(e.key === 'Enter'){
      if (isResolved) return;
      isResolved = true;
      currentInputReject = null;

      const val = input.value;
      div.innerHTML = `${val}`; 
      div.style.color = '#34d399';
      logData += '> ' + val + "\n";
      input.removeEventListener('keydown', onKey);
      callback(val);
    }
  });

  currentInputReject = () => promiseReject("Execution Stopped");
  terminal.scrollTop = terminal.scrollHeight;
}

clearTerminalBtn.addEventListener('click', ()=>{
  terminal.innerHTML = '';
  logData = '';
});


// --- Syntax Validation Helper ---
function validateExpressionSyntax(expr, lineNumber) {
    if (!expr || !expr.trim()) {
        throw new Error(`Missing expression on line ${lineNumber}.`);
    }

    let placeholders = [];
    let tempExpr = expr;

    // 1. Remove strings
    tempExpr = tempExpr.replace(/("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/g, (match) => {
        placeholders.push(match);
        return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });

    // 2. Replace pseudocode operators with JS operators FIRST
    tempExpr = tempExpr.replace(/\bAND\b/gi, '&&')
                        .replace(/\bOR\b/gi, '||')
                        .replace(/\bNOT\b/gi, '!')
                        .replace(/\bDIV\b/gi, 'Math.floor')
                        .replace(/\bMOD\b/gi, '%')
                        .replace(/\^/g, '**')
                        .replace(/<>/g, '!==')
                        .replace(/!=/g, '!==')
                        .replace(/(?<![=!<>])=(?!=)/g, '===');

    // 3. Replace all *remaining* words (variables) with a single valid variable 'v'
    tempExpr = tempExpr.replace(/\b([A-Za-z_]\w*)\b/g, (m) => {
        if (/^(TRUE|FALSE|null)$/i.test(m)) return m.toLowerCase();
        if (m === 'Math') return 'Math';
        return 'v'; 
    });
    
    // 4. Try to compile it
    try {
        new Function(`"use strict"; return (${tempExpr});`);
    } catch (e) {
        throw new Error(`Invalid expression syntax on line ${lineNumber}: "${expr}". Error: ${e.message}`);
    }
}

// --- Line-by-Line Syntax Validation Helper ---
function validateLineSyntax(line, lineNumber) {
    const upper = line.toUpperCase();
    
    // 1. Check for unclosed strings
    let inString = null;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = (i > 0) ? line[i-1] : null;
        if (prevChar === '\\') continue; 
        if (char === '"') {
            if (inString === '"') inString = null;
            else if (inString === null) inString = '"';
        } else if (char === "'") {
            if (inString === "'") inString = null;
            else if (inString === null) inString = "'";
        }
    }
    if (inString !== null) {
        throw new Error(`Syntax Error on line ${lineNumber}: Unclosed ${inString} quote.`);
    }

    // 2. Check keyword syntax
    try {
        if (upper.startsWith('SET') || upper.startsWith('LET')) {
            const m = line.match(/^(?:SET|LET)\s+([a-zA-Z_]\w*)\s*=\s*(.*)$/i);
            if (!m) throw new Error(`Invalid assignment. Expected: SET variable = value`);
            validateExpressionSyntax(m[2], lineNumber); 
        }
        else if (upper.startsWith('DECLARE') || upper.startsWith('INIT') || upper.startsWith('CONSTANT')) {
            const lineAfterKeyword = line.replace(/^(?:DECLARE|INIT|CONSTANT)\s+/i, '');
            if (!lineAfterKeyword.trim()) throw new Error(`DECLARE requires a variable name.`);
            if (lineAfterKeyword.trim().endsWith('=')) {
               throw new Error(`Missing value after '=' in declaration.`);
            }
            const parts = lineAfterKeyword.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
            for (const part of parts) {
                if (part.includes('=')) {
                    const expr = part.substring(part.indexOf('=') + 1).trim();
                    if (!expr) throw new Error(`Missing value in assignment for "${part.split('=')[0].trim()}"`);
                    validateExpressionSyntax(expr, lineNumber);
                }
            }
        }
        else if (upper.startsWith('IF')) {
            const m = line.match(/^IF\s+(.+)\s+THEN$/i);
            if (!m) throw new Error(`Invalid IF. Expected: IF condition THEN`);
            validateExpressionSyntax(m[1], lineNumber);
        }
        else if (upper.startsWith('ELSEIF') || upper.startsWith('ELSE IF')) {
            const m = line.match(/^(?:ELSEIF|ELSE IF)\s+(.+)\s+THEN$/i);
            if (!m) throw new Error(`Invalid ELSEIF. Expected: ELSEIF condition THEN`);
            validateExpressionSyntax(m[1], lineNumber);
        }
        else if (upper.startsWith('FOR')) {
            const m = line.match(/^FOR\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
            if (!m) throw new Error(`Invalid FOR loop. Expected: FOR var = start TO end [STEP val]`);
            validateExpressionSyntax(m[2], lineNumber); 
            validateExpressionSyntax(m[3], lineNumber); 
            if (m[4]) validateExpressionSyntax(m[4], lineNumber); 
        }
        else if (upper.startsWith('WHILE')) {
            const m = line.match(/^WHILE\s+(.+?)(?:\s+DO)?$/i);
            if (!m) throw new Error(`Invalid WHILE. Expected: WHILE condition [DO]`);
            validateExpressionSyntax(m[1], lineNumber);
        }
        else if (upper.startsWith('UNTIL')) {
            const m = line.match(/^UNTIL\s+(.+)$/i);
            if (!m) throw new Error(`Invalid UNTIL. Expected: UNTIL condition`);
            validateExpressionSyntax(m[1], lineNumber);
        }
        else if (upper.startsWith('OUTPUT') || upper.startsWith('PRINT') || upper.startsWith('DISPLAY')) {
            const expr = line.replace(/^(?:OUTPUT|PRINT|DISPLAY)\s+/i, '');
            if (!expr) throw new Error(`PRINT requires something to print.`);
            validateExpressionSyntax(expr, lineNumber);
        }
        else if (upper.startsWith('INPUT') || upper.startsWith('READ') || upper.startsWith('GET')) {
            const m = line.match(/^(?:INPUT|READ|GET)\s+(.+)$/i);
            if (!m) throw new Error(`INPUT requires a variable name.`);
            const parts = m[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
            if (parts.length > 1) {
                const promptExpr = parts.slice(0, -1).join(',');
                validateExpressionSyntax(promptExpr, lineNumber);
            }
        }
        else if (upper.startsWith('SWITCH')) {
            const m = line.match(/^SWITCH\s*\((.+)\)$/i);
            if (!m) throw new Error(`Invalid SWITCH. Expected: SWITCH (expression)`);
            validateExpressionSyntax(m[1], lineNumber);
        }
        else if (upper.startsWith('CASE')) {
            const m = line.match(/^CASE\s+(.+):$/i);
            if (!m) throw new Error(`Invalid CASE. Expected: CASE value:`);
            validateExpressionSyntax(m[1], lineNumber);
        }
    } catch (e) {
        if (e.message.includes(`line ${lineNumber}`)) throw e;
        throw new Error(`Syntax Error on line ${lineNumber}: ${e.message}`);
    }
}

// --- `compileCode` (THE "COMPILER") ---
function compileCode(code) {
  
  // 1. Clean code and Lint each line
  let cleanCode = code.replace(/\/\*.*?\*\//gs, ''); 
  const allLines = cleanCode.split('\n');
  const cleanProgramLines = []; 
  const newLineMap = []; 
  
  // --- This stack is ONLY for validation ---
  const blockStack = []; 

  for (let i = 0; i < allLines.length; i++) {
    let line = allLines[i];
    
    // Find comment markers
    const commentIndex1 = line.indexOf('//');
    const commentIndex3 = line.indexOf("#"); 
    const commentIndex4 = line.indexOf("--");
    const commentIndex5 = line.toUpperCase().indexOf("COMMENT");
    let commentIndex = -1;

    const indices = [commentIndex1, commentIndex3, commentIndex4]
                      .filter(index => index !== -1);
    
    if (commentIndex5 === 0) {
        line = ""; 
    } else if (indices.length > 0) {
      commentIndex = Math.min(...indices);
      line = line.substring(0, commentIndex);
    }

    const trimmedLine = line.trim();
    
    if (trimmedLine) {
      // LINT PASS
      validateLineSyntax(trimmedLine, i + 1);
      
      // --- BLOCK VALIDATION PASS ---
      const programLineIndex = cleanProgramLines.length;
      const lineUpper = trimmedLine.toUpperCase();
      const keyword = lineUpper.split(' ')[0];
      
      if (keyword === 'IF') {
          blockStack.push({ type: 'IF', line: programLineIndex });
      }
      else if (keyword === 'ELSEIF' || (keyword === 'ELSE' && lineUpper.startsWith('ELSE IF'))) {
          const openIf = blockStack[blockStack.length - 1]; // Peek
          if (!openIf || (openIf.type !== 'IF' && openIf.type !== 'ELSEIF')) {
              throw new Error(`Block Error on line ${i + 1}: ELSEIF without matching IF.`);
          }
          // Don't pop, just push. We need the full chain for ELSE.
          blockStack.push({ type: 'ELSEIF', line: programLineIndex });
      }
      else if (keyword === 'ELSE') {
          const openBlock = blockStack[blockStack.length - 1]; // Peek
          if (!openBlock || (openBlock.type !== 'IF' && openBlock.type !== 'ELSEIF')) {
              throw new Error(`Block Error on line ${i + 1}: ELSE without matching IF/ELSEIF.`);
          }
          blockStack.push({ type: 'ELSE', line: programLineIndex });
      }
      else if (keyword === 'ENDIF') {
          // Pop until we find the matching IF
          let foundIf = false;
          while(blockStack.length > 0) {
              const block = blockStack.pop();
              if (block.type === 'IF') {
                  foundIf = true;
                  break;
              }
              // Keep popping ELSEIF and ELSE
              if (block.type !== 'ELSEIF' && block.type !== 'ELSE') {
                  blockStack.push(block); // Put it back, wrong block
                  break;
              }
          }
          if (!foundIf) {
              throw new Error(`Block Error on line ${i + 1}: ENDIF without matching IF.`);
          }
      }
      
      else if (keyword === 'WHILE') {
          blockStack.push({ type: 'WHILE', line: programLineIndex });
      }
      else if (keyword === 'ENDWHILE') {
          const openWhile = blockStack.pop();
          if (!openWhile || openWhile.type !== 'WHILE') {
              throw new Error(`Block Error on line ${i + 1}: ENDWHILE without matching WHILE.`);
          }
      }
      
      else if (keyword === 'FOR') blockStack.push({ type: 'FOR', line: programLineIndex });
      else if (keyword === 'NEXT' || keyword === 'ENDFOR') {
          const block = blockStack.pop();
          if (!block || block.type !== 'FOR') throw new Error(`Block Error on line ${i + 1}: NEXT/ENDFOR without matching FOR.`);
      }
      else if (keyword === 'REPEAT') blockStack.push({ type: 'REPEAT', line: programLineIndex });
      else if (keyword === 'UNTIL') {
          const block = blockStack.pop();
          if (!block || block.type !== 'REPEAT') throw new Error(`Block Error on line ${i + 1}: UNTIL without matching REPEAT.`);
      }
      else if (keyword === 'SWITCH') blockStack.push({ type: 'SWITCH', line: programLineIndex });
      else if (keyword === 'ENDSWITCH') {
          const block = blockStack.pop();
          if (!block || block.type !== 'SWITCH') throw new Error(`Block Error on line ${i + 1}: ENDSWITCH without matching SWITCH.`);
      }

      cleanProgramLines.push(trimmedLine);
      newLineMap.push(i + 1); 
    }
  }

  // Final validation and checks
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
  if (blockStack.length > 0) {
      const leftover = blockStack.pop();
      const errorLine = newLineMap[leftover.line] || 'unknown';
      throw new Error(`Unmatched code block: "${leftover.type}" from line ${errorLine} was never closed.`);
  }

  // 4. Return the "Compiled" Program
  return { 
      cleanLines: cleanProgramLines, 
      originalLineMap: newLineMap,
      // No jumpMap needed for this logic
  };
}


// --- *** NEW: `executeNextLine` (REVERTED TO `controlStack`) *** ---
// This is the stable, working logic from before the jumpMap bug.
async function executeNextLine(controlStack) {
    
    if (!isRunning) return false;
    
    if (currentLine >= programLines.length) {
        const lastLineNum = lineMap.length > 0 ? lineMap[lineMap.length - 1] : 0;
        appendLine(`Error: Code finished without STOP or END command. Last processed line was ${lastLineNum}.`, "error");
        isRunning = false;
        hideLineHighlight();
        return false;
    }

    const originalLineIndex = lineMap[currentLine] - 1;
    highlightCurrentLine(originalLineIndex);

    iterationCount++;
    if (iterationCount > maxIterations) {
        appendLine(`Error: Potential infinite loop detected (exceeded 1,000,000 operations).`, "error");
        isRunning = false;
        hideLineHighlight();
        return false;
    }

    const trimmed = programLines[currentLine];
    const line = trimmed.toUpperCase();
    
    // --- This is the stable `controlStack` skip logic ---
    let shouldSkip = false;
    if (controlStack.length > 0) {
      const top = controlStack[controlStack.length - 1];
      if (top.type === 'SWITCH') {
        if (top.isSkipping) shouldSkip = true;
        else if (!top.hasMatch) shouldSkip = true;
        else shouldSkip = false;
      } else if (top.hasOwnProperty('skip')) { // FOR, REPEAT, IF
        shouldSkip = top.skip;
      }
    }
    
    try { 
    
      // 3. Handle Control Flow
      if (line.startsWith('COMMENT')) {
          currentLine++;
          return true;
      }
      
      // --- FIXED IF LOGIC (uses controlStack) ---
      if(line.startsWith('IF')){
        if (shouldSkip) {
          controlStack.push({ type: 'IF', skip: true, executed: false });
        } else {
          const condition = trimmed.match(/^IF\s+(.+)\s+THEN$/i)[1];
          const conditionResult = evalExpr(condition);
          controlStack.push({ type: 'IF', skip: !conditionResult, executed: conditionResult });
        }
        currentLine++;
        return true;
      }
      
      // --- FIXED ELSEIF LOGIC (uses controlStack) ---
      if(line.startsWith('ELSEIF') || line.startsWith('ELSE IF')){
        const top = controlStack[controlStack.length - 1];
        if (!top || top.type !== 'IF') { throw new Error("ELSEIF without matching IF."); }
        
        if (top.executed) { // A previous IF/ELSEIF was true
          top.skip = true;
        } else { // No previous block was true, so we evaluate this one
          const condition = trimmed.match(/^(?:ELSEIF|ELSE IF)\s+(.+)\s+THEN$/i)[1];
          const conditionResult = evalExpr(condition);
          if (conditionResult) {
            top.executed = true; // Mark that this chain has executed
            top.skip = false;    // Don't skip this block
          } else {
            top.skip = true;     // Skip this block
          }
        }
        currentLine++;
        return true;
      }

      // --- FIXED ELSE LOGIC (uses controlStack) ---
      if(line.startsWith('ELSE')){
        const top = controlStack[controlStack.length - 1];
        if (!top || top.type !== 'IF') { throw new Error("ELSE without matching IF."); }
        
        if (top.executed) { // A previous IF/ELSEIF was true
          top.skip = true;
        } else {
          top.skip = false;
          top.executed = true; // This ELSE block is running
        }
        currentLine++;
        return true;
      }

      // --- FIXED ENDIF LOGIC (uses controlStack) ---
      if(line.startsWith('ENDIF')){
        if (controlStack.length === 0 || controlStack[controlStack.length - 1].type !== 'IF') {
           throw new Error("ENDIF without matching IF.");
        }
        controlStack.pop();
        currentLine++;
        return true;
      }

      // --- FIXED WHILE LOGIC (uses controlStack) ---
      if(line.startsWith('WHILE')){
        const top = (controlStack.length > 0) ? controlStack[controlStack.length - 1] : null;
        if (top && top.type === 'WHILE' && top.startLine === currentLine) {
            // Re-evaluating
            const cond = evalExpr(top.condExpr);
            top.skip = !cond;
        } else {
            // First time
            const condExpr = trimmed.match(/^WHILE\s+(.+?)(?:\s+DO)?$/i)[1];
            if (shouldSkip) {
                // We are inside another loop/if that is skipping
                controlStack.push({type:'WHILE', condExpr:condExpr, startLine: currentLine, skip: true, broken: false});
            } else {
                const cond = evalExpr(condExpr);
                controlStack.push({type:'WHILE', condExpr:condExpr, startLine: currentLine, skip: !cond, broken: false});
            }
        }
        currentLine++;
        return true;
      }

      // --- FIXED ENDWHILE LOGIC (uses controlStack) ---
      if(line.startsWith('ENDWHILE')){
        const top = controlStack[controlStack.length - 1];
        if(!top || top.type !== 'WHILE') { throw new Error("ENDWHILE without matching WHILE loop."); }
        
        if (top.skip === true || top.broken) { 
          controlStack.pop();
        } else {
          currentLine = top.startLine; // Jump back to WHILE
          return true;
        }
        currentLine++;
        return true;
      }
      
      // --- 4. Handle Stateful Loops (FOR, REPEAT) & SWITCH (use controlStack) ---
      if(line.startsWith('FOR')){
        if (shouldSkip) {
            controlStack.push({ type: 'LOOP_SKIP', skip: true });
        } else {
            const m = trimmed.match(/^FOR\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s+TO\s+(.+?)(?:\s+STEP\s+(.+))?$/i);
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

      if(line.startsWith('NEXT') || line.startsWith('ENDFOR')){
        const top = controlStack[controlStack.length - 1];
        if(!top || (top.type !== 'FOR' && top.type !== 'LOOP_SKIP')) { throw new Error("NEXT/ENDFOR without matching FOR loop."); }

        if (top.type === 'LOOP_SKIP' || top.broken) {
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

        if (top.type === 'LOOP_SKIP' || top.broken) {
            controlStack.pop();
        } else {
            const condExpr = trimmed.match(/^UNTIL\s+(.+)$/i)[1];
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

      // --- SWITCH Flow ---
      if(line.startsWith('SWITCH')){
        if (shouldSkip) {
            controlStack.push({ type: 'SWITCH_SKIP', skip: true });
        } else {
            const val = evalExpr(trimmed.match(/^SWITCH\s*\((.+)\)$/i)[1]);
            controlStack.push({ type: 'SWITCH', switchValue: val, hasMatch: false, isSkipping: false });
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('CASE')){
        const top = controlStack[controlStack.length - 1];
        if(!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) { throw new Error("CASE without matching SWITCH."); }
        
        if (top.type === 'SWITCH_SKIP') { /* do nothing */ }
        else if (top.isSkipping) { /* do nothing */ }
        else {
            if (top.hasMatch) { /* We are in fall-through */ }
            else {
                const caseVal = evalExpr(trimmed.match(/^CASE\s+(.+):$/i)[1]);
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
        if(!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) { throw new Error("DEFAULT without matching SWITCH."); }
        
        if (top.type === 'SWITCH_SKIP') { /* do nothing */ }
        else if (top.isSkipping) { /* do nothing */ }
        else {
            if (!top.hasMatch) {
                top.hasMatch = true; 
            }
        }
        currentLine++;
        return true;
      }
      
      if(line.startsWith('BREAK')) {
        if (shouldSkip) {
            currentLine++;
            return true;
        }
        let i = controlStack.length - 1;
        let blockFound = false;
        while(i >= 0) {
            const block = controlStack[i];
            if (block.type === 'SWITCH') {
                block.isSkipping = true; 
                blockFound = true;
                break;
            }
            if (block.type === 'FOR' || block.type === 'REPEAT' || block.type === 'WHILE') {
                block.broken = true; 
                block.skip = true; 
                blockFound = true;
                break;
            }
            i--;
        }
        if (!blockFound) throw new Error("BREAK outside of loop or SWITCH block.");
        
        currentLine++;
        return true;
      }

      if(line.startsWith('ENDSWITCH')){
        const top = controlStack[controlStack.length - 1];
        if(!top || (top.type !== 'SWITCH' && top.type !== 'SWITCH_SKIP')) { throw new Error("ENDSWITCH without matching SWITCH."); }
        controlStack.pop();
        currentLine++;
        return true;
      }

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
      
      if(line.startsWith('DECLARE') || line.startsWith('INIT') || line.startsWith('CONSTANT')){
        const lineAfterKeyword = trimmed.replace(/^(?:DECLARE|INIT|CONSTANT)\s+/i, '');
        const parts = lineAfterKeyword.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
  
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart) continue;
            let varName = "";
            let varValue = null;
            if (trimmedPart.includes('=')) {
                const eqIndex = trimmedPart.indexOf('=');
                varName = trimmedPart.substring(0, eqIndex).trim();
                const expression = trimmedPart.substring(eqIndex + 1).trim();
                varValue = evalExpr(expression); 
            } else {
                varName = trimmedPart;
                varValue = null;
            }
            if (!/^[a-zA-Z_]\w*$/.test(varName)) {
                throw new Error(`Invalid variable name: "${varName}".`);
            }
            if (variables.hasOwnProperty(varName)) {
                throw new Error(`Variable "${varName}" is already declared.`);
            }
            variables[varName] = varValue;
        }
        currentLine++;
        return true;
      }

      if(line.startsWith('OUTPUT') || line.startsWith('PRINT') || line.startsWith('DISPLAY')){
        const rest = trimmed.replace(/^(?:OUTPUT|PRINT|DISPLAY)\s+/i,'');
        const parts = rest.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
        
        let outputString = "";
        for (const part of parts) {
            const trimmedPart = part.trim();
            if (trimmedPart) {
                let value = evalExpr(trimmedPart);
                if (typeof value === 'number' && !Number.isInteger(value)) {
                    value = value.toFixed(2);
                }
                outputString += value; 
            }
        }
        appendLine(outputString);
        currentLine++;
        return true;
      }

      if(line.startsWith('INPUT') || line.startsWith('READ') || line.startsWith('GET')){
        const rest = trimmed.replace(/^(?:INPUT|READ|GET)\s+/i,'');
        const parts = rest.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)(?=(?:(?:[^']*'){2})*[^']*$)/) || [];
        const varName = parts.pop().trim();
        
        if (!variables.hasOwnProperty(varName)) { throw new Error(`Variable "${varName}" not DECLARED before use in INPUT.`); }
        
        const promptText = parts.join(',').trim();
        if (promptText) { appendLine(evalExpr(promptText)); }

        const val = await new Promise((resolve, reject) => {
          appendInvisiblePrompt((value) => {
            if (value instanceof Error) reject(value);
            else resolve(value);
          });
        });

        const numeric = (val !== '' && !isNaN(val) && val.trim() !== '');
        variables[varName] = numeric ? parseFloat(val) : val;
        
        currentLine++;
        return true;
      }

      const assignMatch = trimmed.match(/^(?:SET|LET)?\s*([a-zA-Z_]\w*)\s*=\s*(.*)$/i);
      if(assignMatch && !line.startsWith('IF') && !line.startsWith('FOR') && !line.startsWith('WHILE')){
        const name = assignMatch[1];
        const expr = assignMatch[2];
        
        if (!variables.hasOwnProperty(name)) { throw new Error(`Variable "${name}" not DECLALED before use.`); }
        variables[name] = evalExpr(expr);
        currentLine++;
        return true;
      }

      // --- 6. Unhandled ---
      if (line.startsWith('FUNCTION') || line.startsWith('PROCEDURE') || line.startsWith('ARRAY') || line.startsWith('CONTINUE')) {
          throw new Error(`"${line.split(' ')[0]}" is a valid keyword, but is not implemented in this compiler yet.`);
      }
      
      throw new Error(`Unknown or invalid syntax: "${trimmed}"`);
    
    } catch (error) { 
        if (error.message === "Execution Stopped") {
            isRunning = false;
            hideLineHighlight();
            return false;
        }
        // --- THIS CATCHES THE OUTPUT LIMIT ERROR ---
        appendLine(`Runtime Error on line ${lineMap[currentLine]}: ${error.message}`, 'error');
        isRunning = false;
        hideLineHighlight();
        return false;
    }
}


// --- `runProgram()` ---
async function runProgram() {
    // --- REVERTED: controlStack is used for all logic ---
    const controlStack = []; 
    
    try {
      while (isRunning) {
          const continueRunning = await executeNextLine(controlStack);
          if (!continueRunning) {
              break; 
          }
          if (window.innerWidth < 1024 && terminalPanel.classList.contains('hidden')) {
              showTerminalTab.click();
          }
          await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (e) { 
        if (e.message !== "Execution Stopped") {
          appendLine(`Fatal Error: ${e.message}`, 'error');
        }
        isRunning = false;
    } finally { 
        setControls(false); 
        currentInputReject = null;
    }
}


// --- `evalExpr()` ---
function evalExpr(expr) {
  if (expr === undefined || expr === null) return undefined;

  const stringMatch = expr.match(/^"((?:\\.|[^"\\])*)"$/);
  if (stringMatch) return stringMatch[1].replace(/\\(.)/g, '$1');
  const stringMatch2 = expr.match(/^'((?:\\.|[^'\\])*)'$/);
  if (stringMatch2) return stringMatch2[1].replace(/\\(.)/g, '$1');

  let placeholders = [];
  let tempExpr = expr;

  tempExpr = tempExpr.replace(/("(\\.|[^"\\])*"|'(\\.|[^'\\])*')/g, (match) => {
    placeholders.push(match);
    return `__PLACEHOLDER_${placeholders.length - 1}__`;
  });

  tempExpr = tempExpr.replace(/\b([A-Za-z_]\w*)\b/g, (m) => {
    if (variables.hasOwnProperty(m)) {
      const val = variables[m];
      if (val === null) return null;
      if (typeof val === 'string') return JSON.stringify(val);
      return String(val);
    }
    if (/^(TRUE|FALSE|null)$/i.test(m)) return m.toLowerCase();
    return m;
  });

  tempExpr = tempExpr.replace(/\bAND\b/gi, '&&')
                     .replace(/\bOR\b/gi, '||')
                     .replace(/\bNOT\b/gi, '!')
                     .replace(/&&/g, '&&') 
                     .replace(/\|\|/g, '||')
                     .replace(/(?<![<>=!])!/g, '!')
                     .replace(/\bDIV\b/gi, 'Math.floor')
                     .replace(/\bMOD\b/gi, '%')
                     .replace(/(?<!\d)%(?!\d)/g, '%')
                     .replace(/\^/g, '**')
                     .replace(/==/g, '===')
                     .replace(/<>/g, '!==')
                     .replace(/!=/g, '!==')
                     .replace(/(?<![=!<>])=(?!=)/g, '===');

  tempExpr = tempExpr.replace(/__PLACEHOLDER_(\d+)__/g, (match, index) => {
    return placeholders[index];
  });

  try {
    return Function(`"use strict"; return (${tempExpr});`)();
  } catch (e) {
    throw new Error(`Invalid expression "${expr}". Failed to evaluate: ${e.message}`);
  }
}

// --- `startRun()` ---
function startRun() {
    terminal.innerHTML = '';
    logData = '';
    outputLineCount = 0; // <-- RESET THE COUNTER
    hideLineHighlight();
    setControls(true); 

    try {
        // --- "COMPILE" STEP (Validation only) ---
        const { cleanLines, originalLineMap } = compileCode(editor.value);
        
        // --- "RUN" STEP PREP ---
        programLines = cleanLines;
        lineMap = originalLineMap;
        // --- REMOVED: jumpMap ---
        
        variables = {};
        currentLine = 0;
        iterationCount = 0;
        isRunning = true;
        
        runProgram(); 

    } catch (error) {
        // --- "COMPILE-TIME" ERRORS ---
        appendLine(error.message, 'error');
        isRunning = false;
        hideLineHighlight();
        setControls(false); 
    }
}

runBtn.addEventListener('click', () => startRun());

stopBtn.addEventListener('click', ()=>{
  if(isRunning){
    isRunning = false;
    hideLineHighlight();
    appendLine("Execution Stopped", "system");
    if (currentInputReject) {
      currentInputReject();
      currentInputReject = null;
    }
  }
});

// --- Save Button Logic ---
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

// --- Control Button State ---
function setControls(running) {
  if (running) {
    runBtn.disabled = true;
    runBtn.classList.add('is-running');
    stopBtn.disabled = false;
    resetBtn.disabled = true;
  } else {
    runBtn.disabled = false;
    runBtn.classList.remove('is-running');
    stopBtn.disabled = true;
    resetBtn.disabled = false;
  }
}

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
  if (lightModeBanner && darkModeBanner) {
    if (dark) {
      lightModeBanner.classList.add('hidden');
      darkModeBanner.classList.remove('hidden');
    } else {
      lightModeBanner.classList.remove('hidden');
      darkModeBanner.classList.add('hidden');
    }
  }
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) {
    setTheme(savedTheme === 'dark');
} else {
    setTheme(prefersDark);
}

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

// --- Mobile Tab Logic ---
if (showEditorTab) {
  showEditorTab.addEventListener('click', () => {
    editorPanel.classList.remove('hidden');
    terminalPanel.classList.add('hidden');
    showEditorTab.classList.add('text-text-primary', 'border-accent');
    showEditorTab.classList.remove('text-text-secondary', 'border-transparent');
    showTerminalTab.classList.add('text-text-secondary', 'border-transparent');
    showTerminalTab.classList.remove('text-text-primary', 'border-accent');
  });
}

if (showTerminalTab) {
  showTerminalTab.addEventListener('click', () => {
    terminalPanel.classList.remove('hidden');
    editorPanel.classList.add('hidden');
    showTerminalTab.classList.add('text-text-primary', 'border-accent');
    showTerminalTab.classList.remove('text-text-secondary', 'border-transparent');
    showEditorTab.classList.add('text-text-secondary', 'border-transparent');
    showEditorTab.classList.remove('text-text-primary', 'border-accent');
  });
}

// --- Default Code and Reset Logic ---
const defaultCode = `START
    
    // Welcome to PseudoPlay!

    DECLARE name
    PRINT "Enter your name"
    GET name
    
    // Prints ur name
    PRINT "Hello, " + name + "!"
    
STOP`;

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    editor.value = defaultCode;
    localStorage.setItem('pseudocodeLabCode', defaultCode);
    updateHighlights();
    updateLineNumbers();
    syncScroll();
    appendLine("Editor reset to default code.", "system");
  });
}

// --- Initialize ---
const savedCode = localStorage.getItem('pseudocodeLabCode');
if (savedCode) {
  editor.value = savedCode;
} else {
  editor.value = defaultCode;
}

updateHighlights();
updateLineNumbers();
appendLine("PseudoPlay Compiler Ready.", "system");
setControls(false); // Set initial button state