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
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems
{
    public class DirectBomb : ExplosiveBall
    {
        private Rocket[] rockets;

        public override void OnEnable()
        {
            base.OnEnable();
            rockets = GetComponentsInChildren<Rocket>();
        }

        public override Ball[] GetAffectedBalls()
        {
            List<Ball> balls = new List<Ball>();

            float raycastLength = 10.0f;
            RaycastHit2D[] hits = new RaycastHit2D[20];
            
            float radius = .2f;
            
            foreach (var rocket in rockets)
            {
                var direction = rocket.faceDirectionGlobal;
                int numHits = Physics2D.CircleCastNonAlloc(transform.position, radius, direction, hits, raycastLength);
                for (int i = 0; i < numHits; i++)
                {
                    Ball ball = hits[i].collider.GetComponent<Ball>();
                    // Exclude the current bomb
                    if (ball != null && ball != this && ball.DestroyProperties.destroyByExplosion)
                        balls.Add(ball);
                }
            }

            return balls.ToArray();
        }

        protected override void Activate()
        {
            WaveEffectProcessor.instance.AnimateWaveEffect(this, transform.position+ Vector3.up * 0.5f, 5, 0.3f, 0.1f, .01f, .1f);
            for (var i = 0; i < rockets.Length; i++)
            {
                var rocket = rockets[i];
                rocket.transform.parent = transform.parent;
                rocket.transform.localScale = Vector3.one;
                rocket.LaunchRocket(this);
                if(i == rockets.Length - 1)
                {
                    rocket.callback = () => { LevelManager.instance.AfterDestroyProcess(); };
                }
            }
        }
    }
}