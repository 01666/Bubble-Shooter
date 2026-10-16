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

using System;
using System.Collections;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using UnityEngine;
using UnityEngine.Assertions;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    public class BallContainerBase : MonoBehaviour
    {
        protected Ball savedBall;
        
        public static Action<Ball> OnBallLaunched;
        public static Action<Ball> OnBallSwitched;
        protected Coroutine switchCoroutine;

        public Ball BallCharged { get; set; }

        protected virtual void Start() { }

        public void SwitchBall(BallContainerBase ballContainerFrom, BallContainerBase ballContainerDest, Ball newBall, Action<Ball> callback = null)
        {
            if (switchCoroutine != null)
                return;
            switchCoroutine = StartCoroutine(SwitchBallIenumerator(ballContainerFrom, ballContainerDest, newBall, callback));
        }

        private IEnumerator SwitchBallIenumerator(BallContainerBase ballContainerFrom, BallContainerBase ballContainerDest, Ball newBall, Action<Ball> callback = null)
        {
            var trajectoryHeight = 2f;
            float elapsedTime = 0;

            var duration = EventManager.GameStatus == EStatus.Win ? 0.1f : 0.3f;
            
            while (elapsedTime < duration)
            {
                float t = elapsedTime / duration;
                
                Vector3 p1 = ballContainerFrom.transform.position + new Vector3((ballContainerDest.transform.position.x - ballContainerFrom.transform.position.x) / 2, trajectoryHeight, 0);

                // Calculate the Bezier curve's point at time t
                Vector3 m0 = Vector3.Lerp(ballContainerFrom.transform.position, p1, t);
                Vector3 m1 = Vector3.Lerp(p1, ballContainerDest.transform.position, t);
                Vector3 position = Vector3.Lerp(m0, m1, t);

                newBall.transform.position = position;

                elapsedTime += Time.deltaTime;

                yield return new WaitForEndOfFrame();
            }
            newBall.transform.SetParent(ballContainerDest.transform);

            newBall.transform.position = ballContainerDest.transform.position;
            switchCoroutine = null;
            callback?.Invoke(newBall);
        }

        protected Ball SpawnBall(string prefabName)
        {
            var ball = PoolObject.GetObject(prefabName).GetComponent<Ball>();
            ball.transform.position = transform.position;
            ball.Flags &= ~EBallFlags.Root;
            ball.Flags &= ~EBallFlags.Pinned;
            ball.transform.SetParent(transform);
            ball.gameObject.layer = LayerMask.NameToLayer("LaunchedBubble");
            var componentInChildren = ball.GetComponentInChildren<SpriteRenderer>();
            componentInChildren.sortingOrder = 0;
            componentInChildren.sortingLayerID = 0;
            ball.BallColliderHandler.SetKinematic(ball);
            return ball;
        }

        public void ChangeColor()
        {
            if(BallCharged != null && !BallCharged.GetComponent<BallLaunch>())
            {
                BallCharged.DisableAndReturnToPool();
                BallCharged = SpawnBall("Ball " + ColorManager.instance.GenerateColor()).GetComponent<Ball>();
            }
        }
        
        public int GetColor()
        {
            if (BallCharged == null || BallCharged is ColorBall == false)
                return -1;
            return ((ColorBall)BallCharged).GetColor();
        }

        public void Spawn(string generateColor)
        {
            BallCharged = SpawnBall(generateColor);
            BallCharged.SetSortingLayer(LayerMask.NameToLayer("Default"));
        }
    }
}