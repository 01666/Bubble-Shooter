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

using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    public class BallMovement
    {
        private readonly Ball ball;

        public BallMovement(Ball ball)
        {
            this.ball = ball;
        }

        public void SetPosition(Vector2Int pos)
        {
            // put thrown ball to parent rotation level
            ball.transform.SetParent(ball.levelManager.Level.levelType == ELevelTypes.Rotating && RotatingLevelBall.instance != null ? RotatingLevelBall.instance.GetRotationParent() : ball.parent);
            ball.transform.position = LevelUtils.PosToWorld(pos);
            ball.position = pos;
            if (ball.position.y == 0 && ball.levelManager.Level.levelType != ELevelTypes.Rotating)
            {
                ball.Flags |= EBallFlags.Root;
            }
            else
            {
                ball.Flags &= ~EBallFlags.Root;
            }

            if(EventManager.GameStatus == EStatus.Play)
                ball.BallColliderHandler.SetKinematic(ball);
            ball.levelManager.LevelGridManager.AddBall(ball);
        }

        public void Fall()
        {
            if(ball.cover == null)
                ball.gameObject.layer = LayerMask.NameToLayer("FallingBubble");
            ball.SetSortingLayer(SortingLayer.NameToID("Label"));
            ball.Flags |= EBallFlags.Falling;
            ball.Flags &= ~EBallFlags.Pinned;
            ball.BallColliderHandler.SetDynamic(ball);
            //add random force to ball
            ball.BallColliderHandler.AddForce(new Vector2(Random.Range(-50.5f, 50.5f), 0f));
            // Set the parent if the level type is of type Rotating to prevent rotation of falling balls
            if(ball.levelManager.Level.levelType == ELevelTypes.Rotating)
            {
                ball.transform.SetParent(RotatingLevelBall.instance.GetRotationParent().parent);
            }

            var shouldDestroyBall = ball.hidden || ball.label || ball.destroyProperties.destroyOnFall;
            var ballDestructionOptions = new BallDestructionOptions();
            ballDestructionOptions.falling = true;

            ball.ballDestruction.CommondDestructionTasks();
            
            if(shouldDestroyBall)
                ball.DestroyBall(ballDestructionOptions);
        }
    }
}