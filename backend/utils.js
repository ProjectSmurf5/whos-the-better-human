module.exports = {
    makeid,
    getRoundWins,
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Counts per-round wins from two players' reaction-time score arrays (lower
 * time wins that round; equal times are a push, no point either way). Used to
 * decide the match under the first-to-3-of-5 rule instead of comparing
 * average time across all 5 rounds.
 *
 * @param {number[]} scores1 - player 1's reaction times in ms, one per round played
 * @param {number[]} scores2 - player 2's reaction times in ms, one per round played
 * @returns {{wins1: number, wins2: number, roundsPlayed: number, perRound: string[]}}
 *   perRound[i] is 'p1' | 'p2' | 'push' for round i.
 */
function getRoundWins(scores1, scores2) {
    const roundsPlayed = Math.min(scores1.length, scores2.length);
    let wins1 = 0;
    let wins2 = 0;
    const perRound = [];
    for (let i = 0; i < roundsPlayed; i++) {
        if (scores1[i] < scores2[i]) {
            wins1++;
            perRound.push('p1');
        } else if (scores2[i] < scores1[i]) {
            wins2++;
            perRound.push('p2');
        } else {
            perRound.push('push');
        }
    }
    return { wins1, wins2, roundsPlayed, perRound };
}