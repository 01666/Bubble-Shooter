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

#region

using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Settings;
using UnityEngine;

#endregion

namespace BubbleShooterGameToolkit.Scripts.Gameplay.FieldObjects
{
    public class Hole : ObjectTrigger
    {
        public int score;

        protected override void OnEnable()
        {
            base.OnEnable();
            score = Resources.Load<GameplaySettings>("Settings/GameplaySettings").holesScore[int.Parse(name.Substring(name.Length - 1))];
        }

        protected override int GetScoreMultiplier(Ball ball)
        {
            return score + ball.GetScore();
        }

        protected override void BallCollide(Collider2D other)
        {
            Ball ball = other.GetComponent<Ball>();
            if (ball != null && (ball.Flags & EBallFlags.Destroying) == 0)
            {
                ball.gameObject.SetActive(false);
                DestroyBall(ball);
            }
        }

        protected override void DestroyBall(Ball ball)
        {
            ScoreManager.instance.AddScore(GetScoreMultiplier(ball), transform.position, false);
            var ballDestructionOptions = new BallDestructionOptions();
            ballDestructionOptions.NoScore = true;
            ballDestructionOptions.NoFX = true;
            ball.DestroyBall(ballDestructionOptions);
        }
    }

}