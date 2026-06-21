// Auto-Aim Logic

// Helper: check if a shot works without rendering
function testShot(angleDeg, powerPercent, targetPocket) {
    let simBalls = balls.map(b => b.copy());
    let simCueBall = simBalls.find(b => b.isCue);
    let simRedBall = simBalls.find(b => !b.isCue);

    if (!simCueBall || !simRedBall || !simCueBall.active || !simRedBall.active) return false;

    let angleRad = angleDeg * Math.PI / 180;
    let powerMag = (powerPercent / 100) * CONSTANTS.MAX_POWER;
    simCueBall.vel = new Vec2(Math.cos(angleRad), Math.sin(angleRad)).mult(powerMag);

    let maxSteps = 1500;
    let steps = 0;

    function isMoving() {
        return simBalls.some(b => b.active && b.vel.magSq() > 0);
    }

    while (isMoving() && steps < maxSteps) {
        stepPhysics(simBalls);
        steps++;

        // If white ball pocketed (scratch), invalid
        if (!simCueBall.active) return false;

        // If red ball pocketed, check if it's the target pocket
        if (!simRedBall.active) {
            // It might have fallen into any pocket, check distance to target pocket right before it deactivated
            // Actually, just check if its last position was near the target pocket
            if (simRedBall.pos.dist(targetPocket) < CONSTANTS.POCKET_RADIUS) {
                return true;
            }
            return false; // Pocketed in the wrong pocket
        }
    }
    return false;
}

function findWinningAngle(pocket) {
    let cueBall = balls.find(b => b.isCue);
    let redBall = balls.find(b => !b.isCue);
    if (!cueBall || !redBall || !cueBall.active || !redBall.active) return null;

    let power = 85.0; // Fixed test power for auto-aim

    // We will collect candidate target points for the red ball
    let targets = [];

    // 1. Direct shot target
    targets.push(pocket.copy());

    // 2. 1-Cushion Bank shots for the red ball
    // Top cushion
    targets.push(new Vec2(pocket.x, -pocket.y));
    // Bottom cushion
    targets.push(new Vec2(pocket.x, CONSTANTS.TABLE_HEIGHT + (CONSTANTS.TABLE_HEIGHT - pocket.y)));
    // Left cushion
    targets.push(new Vec2(-pocket.x, pocket.y));
    // Right cushion
    targets.push(new Vec2(CONSTANTS.TABLE_WIDTH + (CONSTANTS.TABLE_WIDTH - pocket.x), pocket.y));

    // For each target, find the required ghost ball position
    for (let target of targets) {
        let dirToPocket = target.sub(redBall.pos).normalize();
        let ghostPos = redBall.pos.sub(dirToPocket.mult(CONSTANTS.BALL_RADIUS * 2));

        // Is ghost pos valid? (not off table)
        if (ghostPos.x < 0 || ghostPos.x > CONSTANTS.TABLE_WIDTH || ghostPos.y < 0 || ghostPos.y > CONSTANTS.TABLE_HEIGHT) {
            continue;
        }

        // Now find the angle from cue ball to ghost pos
        // Wait, the cue ball could also bounce!
        // To keep it simple and robust, let's just do direct shots from cue to ghost ball.
        // If we want cue ball bounces too, we add ghost pos mirrors.
        let cueTargets = [];
        cueTargets.push(ghostPos.copy());
        cueTargets.push(new Vec2(ghostPos.x, -ghostPos.y)); // top
        cueTargets.push(new Vec2(ghostPos.x, CONSTANTS.TABLE_HEIGHT + (CONSTANTS.TABLE_HEIGHT - ghostPos.y))); // bottom
        cueTargets.push(new Vec2(-ghostPos.x, ghostPos.y)); // left
        cueTargets.push(new Vec2(CONSTANTS.TABLE_WIDTH + (CONSTANTS.TABLE_WIDTH - ghostPos.x), ghostPos.y)); // right

        for (let cueTarget of cueTargets) {
            let aimDir = cueTarget.sub(cueBall.pos);
            let baseAngleDeg = Math.atan2(aimDir.y, aimDir.x) * 180 / Math.PI;
            if (baseAngleDeg < 0) baseAngleDeg += 360;

            // Since physics has friction, restitution, and finite timesteps,
            // the exact geometric angle might be slightly off.
            // We sweep around the base angle.
            for (let offset = -2.0; offset <= 2.0; offset += 0.1) {
                let testAng = baseAngleDeg + offset;
                if (testAng < 0) testAng += 360;
                if (testAng >= 360) testAng -= 360;

                if (testShot(testAng, power, pocket)) {
                    return { angle: testAng, power: power };
                }
            }
        }
    }

    return null; // No path found
}

// Canvas click listener for pocket selection
canvas.addEventListener('click', (e) => {
    if (gameState !== 'aiming') return;

    let rect = canvas.getBoundingClientRect();
    // Calculate scale because canvas might be styled via CSS, though here it's fixed size
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;

    let clickX = (e.clientX - rect.left) * scaleX;
    let clickY = (e.clientY - rect.top) * scaleY;
    let clickVec = new Vec2(clickX, clickY);

    for (let p of POCKETS) {
        if (clickVec.dist(p) <= CONSTANTS.POCKET_RADIUS * 2) { // Generous click area
            let result = findWinningAngle(p);
            if (result) {
                angleInput.value = result.angle.toFixed(2);
                powerInput.value = result.power.toFixed(1);
            } else {
                console.log("No valid shot found for this pocket.");
            }
            break;
        }
    }
});
