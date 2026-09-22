// ── Desmos Calculator ────────────────────────────────────────
var desmosCalc  = null;
var calcVisible = false;

// Sections where the calculator is allowed
var CALC_ALLOWED_SECTIONS = [
'Section 2, Module 2: Math',
'Section 2, Module 1: Math'
];

function initDesmos() {
  var elt = document.getElementById('calculator');
  if (elt && typeof Desmos !== 'undefined') {
    desmosCalc = Desmos.GraphingCalculator(elt, {
      keypad:       true,
      expressions:  true,
      settingsMenu: true
    });
  }
}

function toggleCalc() {
  calcVisible = !calcVisible;
  var popup = document.getElementById('calc-popup');
  var btn   = document.getElementById('calc-btn');
  popup.style.display = calcVisible ? 'block' : 'none';
  btn.classList.toggle('active', calcVisible);
  // Desmos needs a nudge to render correctly when shown
  if (calcVisible && desmosCalc) {
    setTimeout(function() { desmosCalc.resize(); }, 50);
  }
}

function hideCalc() {
  calcVisible = false;
  document.getElementById('calc-popup').style.display = 'none';
  var btn = document.getElementById('calc-btn');
  if (btn) btn.classList.remove('active');
}

function updateCalcButtonVisibility() {
  var mod    = MODULES[currentModule];
  var btn    = document.getElementById('calc-btn');
  if (!btn || !mod) return;
  var allowed = CALC_ALLOWED_SECTIONS.indexOf(mod.title) !== -1;
  btn.style.display = allowed ? 'inline-block' : 'none';
  if (!allowed) hideCalc();
}

function makeDraggable() {
  var popup     = document.getElementById('calc-popup');
  var handle    = document.getElementById('calc-drag-handle');
  var isDragging = false;
  var startX, startY, startLeft, startTop;

  handle.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    var rect = popup.getBoundingClientRect();
    startLeft = rect.left;
    startTop  = rect.top;
    // Switch from right-anchored to left-anchored so dragging works predictably
    popup.style.right = 'auto';
    popup.style.left  = startLeft + 'px';
    popup.style.top   = startTop  + 'px';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    popup.style.left = (startLeft + e.clientX - startX) + 'px';
    popup.style.top  = (startTop  + e.clientY - startY) + 'px';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
}
