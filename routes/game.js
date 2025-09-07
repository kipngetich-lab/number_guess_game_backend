const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Predefined expected numbers
const expectedNumbers = ['34', '67']; // example numbers, can be changed

// Utility functions for reward conditions

// Reverse string helper
const reverseStr = (str) => str.split('').reverse().join('');

// Check partial digit matches
function partialDigitMatch(guess, expected) {
  // returns true if at least one digit from guess matches digit from expected in correct order
  for (let i = 0; i < guess.length; i++) {
    if (expected.includes(guess[i])) return true;
  }
  return false;
}

function computeReward(guess1, guess2) {
  // Normalize inputs as strings of length 2
  guess1 = guess1.padStart(2, '0');
  guess2 = guess2.padStart(2, '0');

  const exp1 = expectedNumbers[0];
  const exp2 = expectedNumbers[1];

  // 1. Exact Match (Both Numbers, Correct Order)
  if (guess1 === exp1 && guess2 === exp2) {
    return { reward: 10000, reason: 'Exact match both numbers in correct order' };
  }

  // 2. Exact Match (Both Numbers, Any Order)
  if ((guess1 === exp2 && guess2 === exp1)) {
    return { reward: 4000, reason: 'Exact match both numbers but in wrong order' };
  }

  // 3. Single Match (One Number, Correct Position)
  if ((guess1 === exp1 && guess2 !== exp2) || (guess2 === exp2 && guess1 !== exp1)) {
    return { reward: 1000, reason: 'One number matches in correct position' };
  }

  // 4. Single Match (One Number, Wrong Position)
  if ((guess1 === exp2 && guess2 !== exp1) || (guess2 === exp1 && guess1 !== exp2)) {
    return { reward: 600, reason: 'One number matches in wrong position' };
  }

  // 5. Reverse Digits Match (Both Numbers)
  if (guess1 === reverseStr(exp1) && guess2 === reverseStr(exp2)) {
    return { reward: 400, reason: 'Both numbers digits reversed in same order' };
  }

  // 6. Reverse Digit Match (One Number)
  if ((guess1 === reverseStr(exp1) && guess2 !== exp2) || (guess2 === reverseStr(exp2) && guess1 !== exp1)) {
    return { reward: 200, reason: 'One number digits reversed matching expected number at same position' };
  }

  // 7. Partial Digit Match (Any Order)
  // At least one digit from each guessed number matches a digit from expected numbers in correct order
  if (
    (partialDigitMatch(guess1, exp1 + exp2) && partialDigitMatch(guess2, exp1 + exp2))
  ) {
    return { reward: 300, reason: 'At least one digit from each guessed number matches expected digits' };
  }

  // 8. Partial Digit Match (One Number)
  // At least one digit of one guessed number matches a digit in expected number at correct position
  if (
    (guess1[0] === exp1[0] || guess1[1] === exp1[1] || guess1[0] === exp2[0] || guess1[1] === exp2[1]) ||
    (guess2[0] === exp1[0] || guess2[1] === exp1[1] || guess2[0] === exp2[0] || guess2[1] === exp2[1])
  ) {
    return { reward: 100, reason: 'At least one digit of one guessed number matches digit in expected number at correct position' };
  }

  // No match
  return { reward: 0, reason: 'No match' };
}

// POST /api/game/guess
// Request body: { name: string, guess1: string, guess2: string }
router.post('/guess', async (req, res) => {
  const { name, guess1, guess2 } = req.body;

  // Validate inputs
  if (
    !name ||
    typeof guess1 === 'undefined' ||
    typeof guess2 === 'undefined' ||
    isNaN(guess1) || isNaN(guess2)
  ) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Validate range 00-99
  const g1 = parseInt(guess1, 10);
  const g2 = parseInt(guess2, 10);
  if (g1 < 0 || g1 > 99 || g2 < 0 || g2 > 99) {
    return res.status(400).json({ error: 'Guesses must be between 00 and 99' });
  }

  try {
    // Find user or create
    let user = await User.findOne({ name });
    if (!user) {
      user = new User({ name });
    } else if (user.hasAttempted) {
      return res.status(403).json({ error: 'You have already made your one allowed attempt' });
    }

    // Compute reward
    const { reward, reason } = computeReward(guess1.toString(), guess2.toString());

    // Mark attempt done and accumulate reward
    user.hasAttempted = true;
    user.accumulatedReward += reward;
    await user.save();

    // Find highest rewarded user (master)
    const masterUser = await User.findOne().sort({ accumulatedReward: -1 }).limit(1);

    res.json({
      reward,
      reason,
      accumulatedReward: user.accumulatedReward,
      masterUser: masterUser ? { name: masterUser.name, accumulatedReward: masterUser.accumulatedReward } : null,
      expectedNumbers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/game/master
// Fetch master user and all users rewards
router.get('/master', async (req, res) => {
  try {
    const masterUser = await User.findOne().sort({ accumulatedReward: -1 }).limit(1);
    const allUsers = await User.find().select('name accumulatedReward').sort({ accumulatedReward: -1 });
    res.json({
      masterUser: masterUser ? { name: masterUser.name, accumulatedReward: masterUser.accumulatedReward } : null,
      allUsers,
      expectedNumbers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;