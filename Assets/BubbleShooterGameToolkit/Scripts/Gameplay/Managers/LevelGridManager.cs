// // ©2015 - 2024 Candy Smith
// // All rights reserved
// // Redistribution of this software is strictly not allowed.
// // Copy of this software can be obtained from unity asset store only.
// // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// // FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// // THE SOFTWARE.

using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    /// <summary>
    ///     Class handles the grid of the level like adding and removing balls, checking if the level is moving, etc.
    /// </summary>
    public class LevelGridManager
    {
        private LevelManager levelManager;

        public LevelGridManager(LevelManager levelManager)
        {
            this.levelManager = levelManager;
        }

        // create balls for the loaded level
        public void GenerateLevel()
        {
            int offsetY = levelManager.Level.levelType == ELevelTypes.Rotating ? 4 : 0;

            levelManager.balls = new List<List<Ball>>(levelManager.Level.sizeY);
            for (int y = 0; y < levelManager.Level.sizeY+offsetY; y++)
            {
                var row = new List<Ball>(y % 2 == 1 ? levelManager.Level.sizeX : levelManager.Level.sizeX - 1);

                // Preallocate with nulls
                for (int i = 0; i < row.Capacity; i++)
                {
                    row.Add(null);
                }

                levelManager.balls.Add(row);
            }

            for (int y = 0; y < levelManager.Level.sizeY; y++)
            {
                for (int x = 0; x < (y % 2 == 1 ? levelManager.Level.sizeX : levelManager.Level.sizeX - 1); x++)
                {
                    var index = y * levelManager.Level.sizeX + x;
                    LevelUtils.GenerateItem(x, y+offsetY, levelManager, levelManager.Level.Blocks[index], levelManager.Level);
                }
            }
        }

        /// add ball to the array
        public void AddBall(Ball ball)
        {
            if (ball == null)
                return;

            int y = Mathf.Max(ball.position.y, 0);
            int x = Mathf.Max(ball.position.x, 0);

            if (y >= levelManager.balls.Count)
            {
                var row = new List<Ball>(levelManager.columnMax(y));
                for (int i = 0; i < levelManager.columnMax(y); i++)
                {
                    row.Add(null);
                }

                levelManager.balls.Add(row);
            }

            ball.neighbours = LevelUtils.GetNeighbours<Ball>(ball);
            levelManager.balls[y][x] = ball;
            ball.Flags |= EBallFlags.Pinned;
            ball.gameObject.layer = 6;
        }

        /// remove ball from the array
        public void RemoveBall(Ball ball)
        {
            if (ball == null)
                return;
            if(ball.position.y >= 0 && ball.position.x >= 0)
            {
                var ballToRemove = levelManager.balls[ball.position.y][ball.position.x];
                if (ballToRemove == ball)
                    levelManager.balls[ball.position.y][ball.position.x] = null;
            }
        }

        /// check touch event for neighbours of thrown ball
        public void TriggerTouchedBalls((Ball, Ball) ball, List<Ball> touchedBalls)
        {
            if(touchedBalls.Count > 0)
                ball.Item1.OnTouched(ball.Item2);
            // explosion ball doesn't trigger the OnTouched event
            if(ball.Item1 is ExplosiveBall explosiveBall)
                return;
            ball.Item2?.OnDirectlyTouched(ball.Item1);
            foreach (var touchedBall in touchedBalls)
            {
                touchedBall.OnTouched(ball.Item1);
            }
        }
        
        // destroy balls that were touched by the thrown ball if they are destroyable by touch
        public void HandleTouchedBalls((Ball, Ball) ball, List<Ball> getTouchedBalls)
        {
            List<Ball> ballsToDestroy = new List<Ball>();
            // if the thrown ball is destroyable by touch, add it to the list of balls to be destroyed
            if (ball.Item1.DestroyProperties.destroyByTouch)
                ballsToDestroy.Add(ball.Item1);
            // explosion ball doesn't destroy other balls by touch
            if(ball.Item1 is ExplosiveBall explosiveBall)
            {
                EventManager.GetEvent<object>(EGameEvent.ToDestroy).Invoke(ballsToDestroy);
                return;
            }
            
            foreach (var touchedBall in getTouchedBalls)
            {
                if (touchedBall.DestroyProperties.destroyByTouch)
                {
                    ballsToDestroy.Add(touchedBall);
                }
            }
            if (ballsToDestroy.Count > 0)
            {
                // trigger an event to destroy all the balls in the list
                EventManager.GetEvent<object>(EGameEvent.ToDestroy).Invoke(ballsToDestroy);
            }
        }

        public static List<Ball> GetTouchedBalls((Ball, Ball) ball)
        {
            List<Ball> touchedBalls = new List<Ball>();
            foreach (var neighbour in ball.Item1.neighbours)
            {
                if (neighbour != null)
                {
                    touchedBalls.Add(neighbour);
                }
            }

            return touchedBalls;
        }

        public bool AnyBallExists()
        {
            return ColorManager.instance.AnyColorExists() || levelManager.balls.Any(i =>
                i.Any(j => j != null && (j.Flags & EBallFlags.Pinned) != 0 && (j.DestroyProperties.destroyByExplosion || j.DestroyProperties.destroyByTouch)));
        }

        public bool AnyBallsAreGoingToDestroyOrFalling()
        {
            return Object.FindObjectsByType<Ball>(FindObjectsSortMode.None).Any(ball => ball.Flags.HasFlag(EBallFlags.MarkedForDestroy) || ball.Flags.HasFlag(EBallFlags.Falling) || ball.Flags.HasFlag(EBallFlags.Destroying));
        }

        public bool IsLevelMoving()
        {
            if(levelManager.Level.levelType == ELevelTypes.Vertical && GameCamera.instance.IsMoving())
                return true;
            if(levelManager.Level.levelType == ELevelTypes.Rotating && levelManager.rotatingLevelBall.IsRotating())
                return true;
            return false;
        }
    }
}