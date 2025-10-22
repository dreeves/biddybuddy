// BiddyBuddy: Introspective Binary Search

const MIN =    0 // initial lower bound
const MAX = 9999 // initial upper bound
const EPS =  .01 // smallest amount we can nudge the bounds by but...
// ...we've hardcoded roundp(..., 2) to round to 2 decimal places so changing
// this epsilon from 0.01 doesn't quite work currently.

// Idea: Stick with the amount of precision given in the bounds.
// So we can default to 0.00 to 999.99 and infer an epsilon of 0.01 from that
// (the quantize function in conservaround does that) and then use Javascript's
// toFixed() to keep that many decimal places when computing the goldilocks 
// number. If the user edits the bounds, recompute the epsilon based on how many
// decimal places they used.

// Convenience functions -------------------------------------------------------
const CLOG   = console.log
const ASSERT = console.assert
const min    = Math.min
const max    = Math.max
const sqrt   = Math.sqrt
function $(id) { return document.getElementById(id) } // to be jQuery-esque
// -----------------------------------------------------------------------------

let inf = MIN  // current lower bound
let lox        // current goldilocks number
let sup = MAX  // current upper bound
let blurb = `${MIN} is too low / ${MAX} is too high`

let stack = [] // the undo stack: each element is like [inf, lox, sup, blurb]
let ucount = 0 // how many things there are to undo

// Round x to dp decimal places. So dp=0 means normal integer rounding.
//function roundp(x, dp=0) { return Math.round(x*10**dp)/10**dp }
function roundp(x, dp=0) { return Number.parseFloat(x.toFixed(dp)) }

// Eval but just return null if syntax error.
// Obviously don't use serverside with user-supplied input.
function laxeval(s) {
  try {
    const x = eval(s)
    return typeof x === "undefined" ? null : x
  } catch (e) {
    return null
  }
}

// Parse an arbitrary expression that can be eval'd as a number, like ".5" or
// "30%" or "1/4" or "2+2" or "1e6" or whatever else.
function parsenum(s) {
  if (/^\s*$/.test(s)) return 0                     // treat nothingness as zero
  s = s.replace(/^([^\%]*)\%(.*)$/, "($1)/100$2")   // macro-expand percents
  const x = laxeval(s)
  return x === null ? NaN : x
}

// Sample from a symmetric triangular distribution between a & b. #thankswolfram
function trisamp(a, b) {
  const m = (a+b)/2
  const d = b-a
  const u = Math.random()
  const x = u <= (m-a)/d ? a + sqrt(d*(m-a)*u) : b - sqrt(d*(b-m)*(1-u))
  ASSERT(x >= a && x <= b, "Buggy sampling function")
  return x
}

// Whenever the user edits the bounds:
// 1. Reparse inf and sup
// 2. Recompute lox from the new inf and sup
// 3. Reset the undo stack
// 4. Clear the blurb about the user's last choice of what was too high or low
// 5. If it's now impossible to go lower/higher, disable the lower/higher button
function reparse() {
  const [oldinf, oldsup] = [inf, sup]
  inf = parsenum($('inf').value)
  sup = parsenum($('sup').value)
  if (oldinf !== inf || oldsup !== sup) CLOG(`New bounds: [${inf}, ${sup}]`)
  relox()
  stack = []
  blurb = "&nbsp;"
  $('actionblurb').innerHTML = blurb
  $('golower') .disabled = sup < inf || inf === lox
  $('gohigher').disabled = sup < inf || sup === lox
}

// In case inf and sup are so close together that we manage to hit one of the
// bounds, make sure that happens in a way that respects the user's choice of
// which direction they wanted to go. Like if the bounds are [5.00, 5.01] so the
// only possible loxes are 5.00 and 5.01 and the user says LOWER then we should
// go with 5.00.
function tweak(x, dir) {
  //CLOG(`tweaking ${x} in dir ${dir}`)
  if (!isFinite(x)) return x
  // We shouldn't hardcode that 2; could use conservaround with EPS
  return dir<0 ? roundp(max(inf, min(x, sup - EPS)), 2) :
                 roundp(min(sup, max(x, inf + EPS)), 2)
}

// Set the goldilocks number to something between inf and sup.
function relox(dir=0) {
  lox = isNaN(inf) || isNaN(sup)  ? NaN :
        inf - sup >= .01          ? "> 💥 <" :  // in case inf > sup
                                    tweak(trisamp(inf, sup), dir)
  $('loxval').innerHTML = lox
}

// Pop previous state off the undo stack, disable the button if nothing else to
// undo.
function undolox() {
  if (stack.length < 1) return null // nothing to undo
  CLOG(`Undo!`)
  ;[inf, lox, sup, blurb] = stack.pop()
  $('ucount').innerHTML = --ucount
  $('inf').value = inf
  $('sup').value = sup
  $('loxval').innerHTML = lox
  $('actionblurb').innerHTML = blurb
  if (stack.length === 0) $('undobut').disabled = true
  $('golower') .disabled = sup < inf || inf === lox
  $('gohigher').disabled = sup < inf || sup === lox
}

// Whenever the user clicks golower (dir is -1) or gohigher (dir is +1):
// 1. Push the current state onto the undo stack
// 2. Enable the undo button (if it wasn't already)
// 3. Set the new bounds
// 4. Set the action blurb to describe what the user just did
// 5. Compute the new lox (and show it on the middle button)
// 6. If it's now impossible to go lower/higher, disable the lower/higher button
function bumpit(dir) {
  CLOG(`Bounds [${inf}, ${sup}] and going ${dir === -1 ? "lower" : "higher"}`)
  stack.push([inf, lox, sup, blurb])
  $('ucount').innerHTML = ++ucount
  $('undobut').disabled = false
  if (dir<0) { sup = tweak(lox, dir); $('sup').value = sup }
  else       { inf = tweak(lox, dir); $('inf').value = inf }
  blurb = `${lox} is too ${dir<0 ? "high" : "low"}`
  $('actionblurb').innerHTML = blurb
  relox(dir)
  $('golower') .disabled = sup < inf || inf === lox
  $('gohigher').disabled = sup < inf || sup === lox
}

document.addEventListener('DOMContentLoaded', () => { // -------- document-ready

$('inf').focus() // this can be annoying when developing cuz it steals focus

// Initialize inf and sup and lox and the blurb
if (inf !== 0) $('inf').value = inf  // leaving the field blank implies zero
$('sup').value = sup
//$('sup').placeholder?
$('default-bounds').innerHTML = `${MIN}&ndash;${MAX}`
relox()
$('actionblurb').innerHTML = blurb
  
$('inf')     .addEventListener('input', e => { reparse() })
$('sup')     .addEventListener('input', e => { reparse() })
$('golower') .addEventListener('click', e => { bumpit(-1) })
$('gohigher').addEventListener('click', e => { bumpit(+1) })
$('undobut') .addEventListener('click', e => { undolox() })
// The following listen for hitting enter or command- or control-enter when the
// user is editing the lower/upper bounds, but we don't need to do anything
// since we're already immediately updating the goldilocks number on every 
// keystroke.
$('inf').addEventListener('keyup', e => {
  if (e.key==="Enter") CLOG("user hit enter in the lower-bound input field")
})
$('inf').addEventListener('keydown', e => {
  if (e.metaKey && e.key === "Enter") CLOG("command- or control-enter")
})

}) // ------------------------------------------------------- end document-ready
