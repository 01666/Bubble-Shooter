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
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;
using UnityEngine.Assertions;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    public class RaycastData
    {
        public Vector2Int positionNearBall;
        public List<RaycastHit2D> hits;
        public List<Vector2> points;
        public Vector2 screenMousePosition;
        public Vector2 worldMousePosition;
        
        public static RaycastData MockData(Vector3 point)
        {
            return new RaycastData
            {
                positionNearBall = Vector2Int.zero,
                hits = new List<RaycastHit2D>(),
                points = new List<Vector2>(),
                screenMousePosition = point
            };
        }
    }

    public class RaycastManager
    {
        private const string BorderTag = "Border";
        private const string BallTag = "Ball";
        private const string TopBorderTag = "TopBorder";
        private const string BottomBorderTag = "BottomBorder";

        const int maxBounces = 10; // The number of times the ray can bounce
        const float radius = 0.2f; // circle radius
        const int resultBufferCount = 3; // the max amount of results from the CircleCastNonAlloc
        readonly RaycastHit2D[] resultBuffer = new RaycastHit2D[resultBufferCount];

        public RaycastData RaycastHit2D(Vector3 startPosition, GameObject ignoreObject, Vector3 direction)
        {
            var list = CalculateCircleCasts(startPosition, direction, 100, 0, out Vector2Int ballPos, ignoreObject, radius);
            return new RaycastData { hits = new List<RaycastHit2D>(list), positionNearBall = ballPos, points = list.Select(x => x.point).ToList()};
        }

        private RaycastHit2D[] CalculateCircleCasts(Vector2 origin, Vector2 direction, float distance, int bounces, out Vector2Int ballPosition, GameObject ignoreObject, float radius,
            List<RaycastHit2D> hits = null)
        {
            ballPosition = Vector2Int.zero * -100;

            if (bounces > maxBounces)
                return hits.ToArray();

            LayerMask mask = (1 << 6) | (1 << 7);

            int hitsCount = Physics2D.CircleCastNonAlloc(origin, radius, direction, resultBuffer, distance, mask);

            if (hitsCount == 0 && hits != null)
                return hits.ToArray(); // No hit

            if (hits == null)
                hits = new List<RaycastHit2D>(10);

            for (int i = 0; i < hitsCount; i++)
            {
                if (resultBuffer[i].collider.gameObject == ignoreObject)
                    continue;

                var directionBackwardOffset = (origin - resultBuffer[i].point).normalized;
                hits.Add(resultBuffer[i]);

                // check ball position
                if (resultBuffer[i].collider.CompareTag(BallTag))
                {
                    var transformPosition = resultBuffer[i].collider.ClosestPoint(resultBuffer[i].centroid);
                    ballPosition = LevelUtils.GetAvailablePositionNear(transformPosition);
                    if(ballPosition.y == -1)
                    {
                        directionBackwardOffset = (origin - resultBuffer[i].centroid).normalized;
                        transformPosition = resultBuffer[i].centroid + directionBackwardOffset * 1.5f;
                        ballPosition = LevelUtils.GetAvailablePositionNear(transformPosition);
                        if(ballPosition.y < LevelManager.instance.balls.Count)
                            Assert.IsTrue(ballPosition.y > -1 && ballPosition.x < LevelManager.instance.balls[ballPosition.y].Count, $"{ballPosition} ");

                    }
                    return hits.ToArray();
                }
                else
                {
                    // check top position
                    if (resultBuffer[i].collider.CompareTag(TopBorderTag) && LevelManager.instance.Level.levelType == ELevelTypes.Vertical)
                    {
                        ballPosition = LevelUtils.WorldToPos(resultBuffer[i].point + directionBackwardOffset * radius);
                        return hits.ToArray();
                    }

                    // check bottom position
                    else if (resultBuffer[i].collider.CompareTag(BottomBorderTag) && LevelManager.instance.Level.levelType == ELevelTypes.Rotating)
                        return hits.ToArray();

                    // Calculate the distance between the last two points
                    float lastPointsDistance = hits.Count >= 2 ? Vector2.Distance(hits[^1].point, hits[^2].point) : 0;

                    // Increase the offset if the distance between the last two points is too small
                    Vector2 offset = lastPointsDistance < radius ? directionBackwardOffset : Vector2.zero;

                    // Add a small offset to the origin of the reflected raycast
                    Vector2 reflectedOrigin = resultBuffer[i].point + offset;
                    Vector2 reflectedDirection = Vector2.Reflect(direction.normalized, resultBuffer[i].normal);
                    CalculateCircleCasts(reflectedOrigin, reflectedDirection, distance, bounces + 1, out ballPosition, resultBuffer[i].collider.gameObject, radius, hits);
                    break;
                }
            }

            return hits.ToArray();
        }
    }
}