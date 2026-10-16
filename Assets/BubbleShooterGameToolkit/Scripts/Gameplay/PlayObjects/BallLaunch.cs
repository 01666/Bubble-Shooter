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
using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using DG.Tweening;
using UnityEngine;
using UnityEngine.Rendering;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    ///  script attached to the thrown ball to move it
    public class BallLaunch : MonoBehaviour
    {
        public Ball ball;
        private float speed = 25;
        public bool launched;

        // Variables to hold the screen boundaries and ball's direction
        private Vector2 screenBounds;
        public Vector3 direction;
        private RaycastData raycastData;
        private RaycastData raycastDataSave;
        private int pointIndex;
        private float duration;
        private float timeCounter;
        private SortingGroup sorting;
        private bool controlRaycast;
        private int lastCheckPoint;
        private Ball ballCollided;
        private bool anyBordersOnWay;

        private void Start()
        {
            speed = GameManager.instance.GameplaySettings.ballSpeed;
        }

        public void FixedUpdate()
        {
            if (launched)
            {
                timeCounter += Time.deltaTime;
                ball.transform.position = InterpolateLaunching(ball.transform.position, speed);
                if(EventManager.GameStatus == EStatus.Win)
                {
                    speed = 20;
                    if (ball.transform.position.y >= GameCamera.instance.transform.position.y + (5 - Math.Abs(ball.transform.position.x)))
                    {
                        launched = false;
                        LevelManager.instance.destroyManager.DestroyComponent(this, ()=> ball.DestroyBall());
                    }
                }
            }

            if (raycastData != null && raycastData.points.Count > 0)
            {
                // check if ball out of last hit position
                if (pointIndex == raycastData.points.Count - 1)
                {
                    var lastHit = raycastData.hits[^1];
                    var lastpoint = raycastData.points[^1];
                    if(lastHit.collider.transform.CompareTag("BottomBorder"))
                    {
                        return;
                    }
                    if (Vector2.Distance(ball.transform.position, lastpoint) > 0.5f)
                    {
                        // check if vectors are opposite direction
                        if (Vector2.Dot(direction, (lastpoint - (Vector2)ball.transform.position).normalized) < 0)
                        {
                            StopBall();
                        }
                    }
                    // check distance to last hit position
                    if (Vector2.Distance(ball.transform.position, lastpoint) < 0.5f && lastHit.collider.transform.CompareTag("Ball"))
                    {
                        var ballCollided = lastHit.collider.transform.GetComponent<Ball>();
                        if((ballCollided.Flags & EBallFlags.Pinned) == 0)
                        {
                            Vector3 origin = (transform.position + direction).SnapZ();
                            ReCheckBubblesAhead(origin, origin+direction);
                        }
                        else
                        {
                            StopBall(ballCollided);
                        }
                    }
                }
                
                // check bubbles ahead every .2f of duration if level is moving or no borders on way
                if (launched && timeCounter < duration)
                {
                    float progress = timeCounter / duration;
                    float interval = 0.2f;
                    int checkPoint = (int)(progress / interval);

                    if (checkPoint > lastCheckPoint)
                    {
                        Vector3 origin;
                        if (LevelManager.instance.LevelGridManager.IsLevelMoving() && !anyBordersOnWay || LevelUtils.GetBall<Ball>(raycastData.positionNearBall.x, raycastData.positionNearBall.y))
                        {
                            origin = (transform.position + direction).SnapZ();
                        }
                        else
                        {
                            return;
                        }

                        ReCheckBubblesAhead(origin, origin + direction);
                        lastCheckPoint = checkPoint;
                    }
                }
            }
        }

        private void ReCheckBubblesAhead(Vector3 origin, Vector3 nextPoint)
        {
            raycastData = LevelManager.instance.GetRaycastData(gameObject, origin, nextPoint);
            pointIndex = 0;
        }
        private void OnTriggerEnter2D(Collider2D other)
        {
            if(other.transform.CompareTag("BottomBorder"))
            {
                ball.BallColliderHandler.SetDynamic(ball);
                ball.SetSortingLayer(SortingLayer.NameToID("Label"));
                if (!launched) return;
                launched = false;
                ball.RestoreParent();
                DestroyComponent();
            }
        }

        // Method to check and adjust the ball's position based on screen bounds
        private Vector3 InterpolateLaunching(Vector3 transformPosition, float speed)
        {
            var (topRight, bottomLeft) = GameCamera.instance.CalculateScreenBounds();

            // Move the position in the current direction
            transformPosition += direction * (speed * Time.deltaTime);

            // If the position is outside the horizontal screen bounds, reverse horizontal direction
            if (transformPosition.x < bottomLeft.x)
            {
                transformPosition.x = bottomLeft.x;
                direction = GetDirection();
            }
            else if (transformPosition.x > topRight.x)
            {
                transformPosition.x = topRight.x;
                direction = GetDirection();
            }

            // If the level type is Rotating and the position is outside the vertical screen bounds, reverse vertical direction
            if (LevelLoader.instance.CurrentLevel.levelType == ELevelTypes.Rotating && transformPosition.y > topRight.y)
            {
                transformPosition.y = topRight.y;
                direction = GetDirection();
            }
            
            return transformPosition;
        }

        public void Launch(RaycastData raycastData)
        {
            if (launched) return;
            if(LevelManager.instance.Level.levelType == ELevelTypes.Vertical)
                ball.RestoreParent();
            else
            {
                ball.transform.SetParent(GameCamera.instance.transform);
            }
            EventManager.GetEvent<Ball>(EGameEvent.BallLaunched).Invoke(ball);
            launched = true;

            ball.ballSoundable.PlayExplosionSound(ball.audioProperties.launchSound);

            this.raycastData = raycastData;
            raycastDataSave = raycastData;
            for (int i = 0; i < raycastData.hits.Count-1; i++)
            {
                if (raycastData.hits[i].transform.CompareTag("Border"))
                {
                    anyBordersOnWay = true;
                    break;
                }
            }

            duration = GetDuration(raycastData);
            timeCounter = 0f;
            pointIndex = -1;
            direction = GetDirection(); //start or change direction
            if(EventManager.GameStatus != EStatus.Win)
            {
                sorting = ball.gameObject.AddComponentIfNotExists<SortingGroup>();
                sorting.sortingOrder = 10;
            }
            // Set the Rigidbody to Kinematic
            ball.BallColliderHandler.SetKinematic(ball, true);
        }

        private float GetDuration(RaycastData raycastData)
        {
            // total distance from ball to last hit point through all hits
            var totalDistance = 0f;
            for (int i = 0; i < raycastData.hits.Count; i++)
            {
                if (i == 0)
                {
                    totalDistance += Vector2.Distance(ball.transform.position, raycastData.hits[i].point);
                }
                else
                {
                    totalDistance += Vector2.Distance(raycastData.hits[i - 1].point, raycastData.hits[i].point);
                }
            }
            
            // get time to reach last hit point
            return totalDistance / speed;
        }

        private Vector2 GetDirection()
        {
            Vector2 prevPosition = LevelManager.instance.launchContainer.transform.position;
            Vector2 nextPosition = (raycastData.screenMousePosition);
            if(raycastData.points.Count > 0)
            {
                pointIndex = Mathf.Clamp(++pointIndex, 0, raycastData.points.Count - 1);
                if(pointIndex > 0)
                    prevPosition = transform.position;
                nextPosition = raycastData.points[pointIndex];
            }

            return (nextPosition - prevPosition).normalized;
        }

        private void StopBall(Ball ballCollided = null)
        {
            if (!launched) return;
            launched = false;
            ball.RestoreParent();
            if (LevelLoader.instance.CurrentLevel.levelType == ELevelTypes.Rotating)
            {
                // rotate the level for rotating level
                RotatingLevelBall.instance.Rotate(ball.transform.position);
            }

            var newPos = LevelUtils.PosToWorld( raycastData.positionNearBall);
            WaveEffectProcessor.instance.AnimateWaveEffect(ball, newPos, 3, 0.2f, 0.1f, .01f, 0);
            transform.DOMove(newPos, 0.1f).OnComplete(()=>OnFinished(ballCollided));
        }

        private void OnFinished(Ball ballCollided)
        {
            ball.SetPosition( raycastData.positionNearBall);
            if (ballCollided == null && ball.neighbours[0])
            {
                ballCollided = ball.neighbours[0];
            }
            
            this.ballCollided = ballCollided;
            DestroyComponent();
        }

        private void DestroyComponent()
        {
            Destroy(sorting);
            Destroy(this);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<(Ball, Ball)>(EGameEvent.BallStopped).Invoke((ball, ballCollided));
            DestroyComponent();
        }
    }
}