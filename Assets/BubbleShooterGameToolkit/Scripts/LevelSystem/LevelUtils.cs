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
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay;
using BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Covers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;
using UnityEngine.Assertions;
using Object = UnityEngine.Object;

namespace BubbleShooterGameToolkit.Scripts.LevelSystem
{
    public static class LevelUtils
    {
        private static Transform centerPivot => LevelManager.instance.ball_center_pivot;

        public static Vector3 PosToWorld(Vector2Int pos)
        {
            var ballWidth = GameManager.instance.GameplaySettings.ballWidth;
            var ballHeight = GameManager.instance.GameplaySettings.ballHeight;
            var position = LevelManager.instance.field.position +
                           new Vector3(pos.x * ballWidth - (LevelManager.instance.columnMax(pos.y) / 2f * ballWidth), -pos.y * ballHeight, 0);
            if (LevelLoader.instance.CurrentLevel.levelType == ELevelTypes.Rotating && centerPivot != null)
            {
                position = centerPivot.rotation * (position - centerPivot.position) + centerPivot.position;
            }

            return position;
        }

        public static Vector2Int WorldToPos(Vector3 vec)
        {
            var ballWidth = GameManager.instance.GameplaySettings.ballWidth;
            var ballHeight = GameManager.instance.GameplaySettings.ballHeight;
            
            if (LevelLoader.instance.CurrentLevel.levelType == ELevelTypes.Rotating && centerPivot != null)
            {
                vec = Quaternion.Inverse(centerPivot.rotation) * (vec - centerPivot.position) + centerPivot.position;
            }

            var v = vec - LevelManager.instance.field.position;
            int y = (int)(Mathf.Abs(v.y) / ballHeight);
            var columnMax = LevelManager.instance.columnMax(y) - 1;
            var x1 = (v.x + columnMax / 2f * ballWidth);
            var x2 = (v.x + columnMax);
            var resultX = (x1 + x2) / 2f; // Averaging
            var worldToPos = new Vector2Int((int)(resultX / ballWidth), y);
            worldToPos.x = Mathf.Clamp(worldToPos.x, 0, columnMax);

            return worldToPos;
        }

        static Collider2D[] results = new Collider2D[7];
        public static Ball[] GetNeighbours<T>(Ball ball, Func<T, bool> filter = null) where T : Ball
        {
            var neighbours = new Ball[ball.neighbours.Length];
            var numResults = GetCollidersAround(ball.transform.position, results, 1.5f);
            int offset = 0;
            for (int i = 0; i < results.Length; i++)
            {
                if(i < neighbours.Length)
                    neighbours[i] = null;
                if (i < numResults)
                {
                    T neighbourBall = results[i].GetComponent<T>();
                    if (neighbourBall != null && neighbourBall != ball && neighbourBall.Flags.HasFlag(EBallFlags.Pinned) && (filter == null || filter(neighbourBall)))
                    {
                        neighbours[Mathf.Clamp(offset++, 0, 5)] = neighbourBall;
                    }
                }
            }

            return neighbours;
        }
        
        private static readonly int[][] cShifts = {
            new int[] { 0, 1, 1, 1, 0, -1 },  // Even row
            new int[] { -1, 0, 1, 0, -1, -1 }      // Odd row
        };

        private static readonly int[] rShifts = { -1, -1, 0, 1, 1, 0 };
        private static HashSet<Ball> ballsWithNeighbours;


        public static Ball[] GetNeighboursInit<T>(Ball ball, Func<T, bool> filter = null) where T : Ball
        {
            int checkCol = ball.position.x;
            int checkRow = ball.position.y;

            int[] currentCShifts = cShifts[checkRow % 2]; // Select the appropriate shift array based on the row

            for (int i = 0; i < 6; i++)
            {
                ball.neighbours[i] = null;
                int c = checkCol + currentCShifts[i];
                int r = checkRow + rShifts[i];

                var neighbour = GetBall<T>(c, r);
                if (neighbour != null && (filter == null || filter(neighbour)))
                {
                    ball.neighbours[i] = neighbour;
                }
            }

            return ball.neighbours;
        }


        public static int GetCollidersAround(Vector3 position, Collider2D[] res, float radius)
        {
            // init results array
            for (int i = 0; i < res.Length; i++)
            {
                res[i] = null;
            }
            int numResults = Physics2D.OverlapCircleNonAlloc(position, radius, res, 1 << 6 | 1 << 2);
            return numResults;
        }

        //get neighbours around with depth for bomb
        public static List<List<T>> GetExtendedNeighbours<T>(Ball ball, int depth, Func<T, bool> filter = null) where T : Ball
        {
            // Define list to store the resulting sets of Balls per depth
            List<List<T>> result = new List<List<T>>();

            // Get immediate neighbours
            var currentDepthBalls = new List<T>();
            for (int i = 0; i < ball.neighbours.Length; i++)
            {
                var neighbourBall = ball.neighbours[i];
                if (neighbourBall != null && neighbourBall != ball && neighbourBall.Flags.HasFlag(EBallFlags.Pinned) && (filter == null || filter((T)neighbourBall)))
                {
                    currentDepthBalls.Add((T)neighbourBall);
                }
            }

            result.Add(currentDepthBalls);

            // If depth is more than 1, get neighbours of the neighbours
            if(depth > 1)
            {
                foreach(var neighbour in currentDepthBalls.Where(n => n != null))
                {
                    var deeperBalls = GetExtendedNeighbours<T>(neighbour, depth - 1, filter);

                    // Merge each depth into the main list at the right index
                    for(int i = 0; i < deeperBalls.Count; i++)
                    {
                        if(result.Count <= i+1) result.Add(new List<T>());
                        result[i+1].AddRange(deeperBalls[i]);
                    }
                }
            }

            // Remove duplicates from all sub-arrays, check every element of subarray
            HashSet<T> uniqueElements = new HashSet<T>();
            List<List<T>> resultList = new List<List<T>>();

            foreach (var subarray in result)
            {
                List<T> newSubArray = new List<T>();
                foreach (var element in subarray)
                {
                    if (uniqueElements.Add(element)) // .Add returns false if the element is already in the HashSet
                    {
                        newSubArray.Add(element);
                    }
                }

                resultList.Add(newSubArray);
            }

            result = resultList;

            return result;
        }

        public static T GetBall<T>(int c, int r) where T : Ball
        {
            if (c < 0 || r < 0 || r >= LevelManager.instance.balls.Count || c >= LevelManager.instance.balls[r].Count)
                return null;

            if (LevelManager.instance.balls[r][c] is T ball)        
                return ball;

            return null;
        }

        /// Method enables colliders for visible balls and disables for invisible balls
        public static void CheckColliders(List<List<Ball>> balls)
        {
            int c = 0;
            for (int y = balls.Count - 1; y >= 0; y--)
            {
                for (int x = balls[y].Count - 1; x >= 0; x--)
                {
                    var ball = LevelManager.instance.balls[y][x];
                    if (ball != null && ball.Flags.HasFlag(EBallFlags.Pinned) && ball.gameObject.activeSelf && ball.IsVisible() && !ball.BallColliderHandler.IsColliderEnabled())
                    {
                        c++;
                        ball.BallColliderHandler.SetKinematic(ball);
                    }

                    if (c > 100)
                    {
                        return;
                    }
                }
            }
        }

        public static void CleanUpBallsForRotatingLevel(Transform rotatingBall, List<List<Ball>> balls)
        {
            foreach (var ballList in balls)
            {
                foreach (var ball in ballList)
                {
                    if (ball != null && ball.Flags.HasFlag(EBallFlags.Pinned) && ball.transform.parent != rotatingBall)
                    {
                        ball.transform.SetParent(rotatingBall);
                    }
                }
            }

            var attachables = Object.FindObjectsOfType<Attachable>();
            foreach (var attachable in attachables)
            {
                if (attachable.transform.GetComponentInParent<Ball>() == null)
                {
                    attachable.transform.SetParent(rotatingBall);
                }
            }
        }

        public static Vector2Int GetAvailablePositionNear(Vector3 centerPoint)
        {
            Vector2Int bestPosition = new Vector2Int(-1, -1);
            float bestDistance = float.MaxValue;

            for (int x = -1; x < 2; x++)
            {
                for (int y = -1; y < 2; y++)
                {
                    var v = WorldToPos(centerPoint + new Vector3(x,y)*1.2f).BoundBorders();
                    if(v.y < LevelManager.instance.balls.Count)
                        Assert.IsTrue(v.x < LevelManager.instance.balls[v.y].Count, $"{v} {LevelManager.instance.balls[v.y].Count}");
                    var ball = GetBall<Ball>(v.x, v.y);
                    if (ball == null || !ball.enabled)
                    {
                        var posToWorld = PosToWorld(v);
                        float distance = Vector2.Distance(posToWorld, centerPoint);
                        if (distance < bestDistance)
                        {
                            bestDistance = distance;
                            bestPosition = v;
                        }
                    }
                }
            }

            return bestPosition;
        }

        #region BallCreation
        public static Ball GenerateItem(int x, int y, LevelManager levelManager, LevelItem levelItem, Level level)
        {
            Ball ball = null;
            if (!levelItem.levelElement.IsEmpty)
            {
                if(levelItem.levelElement.Prefab.name == "1RandomBall")
                    ball = CreateBall(GetRandomBallPrefabName(level.randomBallColors), x, y, levelItem);
                else
                    ball = CreateBall(levelItem.levelElement.Prefab.name, x, y, levelItem);
                levelManager.balls[y][x] = ball;
            }
            else
            {
                if (levelItem.levelElement.IsEmpty && (!levelItem.cover.IsEmpty || !levelItem.hidden.IsEmpty || !levelItem.label.IsEmpty || !levelItem.holding.IsEmpty))
                {
                    ball = CreateBall("EmptyBall", x, y, levelItem);
                    levelManager.balls[y][x] = ball;
                }
            }

            return ball;
        }

        private static string GetRandomBallPrefabName(bool[] levelRandomBallColors)
        {
            List<int> randomBallColors = new List<int>();
            for (int i = 0; i < levelRandomBallColors.Length; i++)
            {
                if (levelRandomBallColors[i])
                    randomBallColors.Add(i);
            }
            var randomBallColor = randomBallColors.ElementAt(UnityEngine.Random.Range(0, randomBallColors.Count()));
            return $"Ball {randomBallColor}";
        }

        private static Ball CreateBall(string prefabName, int x, int y, LevelItem levelItem)
        {
            Ball ball = PoolObject.GetObject(prefabName).GetComponent<Ball>();
            ball.SetPosition(new Vector2Int(x, y));
            ball.transform.rotation = levelItem.levelElement.rotation;
            SetAttachable(ball, levelItem);
            return ball;
        }

        private static void SetAttachable(Ball ball, LevelItem levelItem)
        {
            if (!levelItem.cover.IsEmpty)
            {
                var attachable = PoolObject.GetObject(levelItem.cover.Prefab.name).GetComponent<Attachable>();
                ball.cover = (Cover)attachable;
                ball.cover.ball = ball;
                ball.cover.transform.SetParent(ball.transform.GetChild(0));
                attachable.SetPosition(ball.transform.position);
                ball.cover.AdjustSortingOrder(ball.position.y);
            }

            if (!levelItem.label.IsEmpty)
            {
                var attachable = PoolObject.GetObject(levelItem.label.Prefab.name).GetComponent<Attachable>()  as LabelItem;
                ball.label = attachable;
                attachable.transform.SetParent(ball.transform.GetChild(0));
                attachable.ball = ball;
                attachable.SetPosition(ball.transform.position);
            }

            if (!levelItem.hidden.IsEmpty)
            {
                var attachable = PoolObject.GetObject(levelItem.hidden.Prefab.name).GetComponent<Attachable>();
                ball.hidden = attachable;
                attachable.transform.SetParent(ball.transform.GetChild(0));
                attachable.ball = ball;
                attachable.SetPosition(ball.transform.position);
            }

            if (!levelItem.holding.IsEmpty)
            {
                var attachable = PoolObject.GetObject(levelItem.holding.Prefab.name).GetComponent<Attachable>();
                attachable.ball = ball;
                attachable.SetPosition(ball.transform.position);
            }
        }

        public static void FillNeibhours(List<List<Ball>> balls)
        {
            for (int y = 0; y < balls.Count; y++)
            {   
                for (int x = 0; x < balls[y].Count; x++)
                {
                    var ball = balls[y][x];
                    if (ball == null)
                        continue;
                    ball.neighbours = GetNeighboursInit<Ball>(ball);
                }
            }
        }
        
        public static void UpdateNeighbours(List<List<Ball>> balls)
        {
            for (int y = 0; y < balls.Count; y++)
            {   
                for (int x = 0; x < balls[y].Count; x++)
                {
                    var ball = balls[y][x];
                    if (ball == null || !ball.Flags.HasFlag(EBallFlags.DirtyToCheckNeighbours))
                        continue;
                    ball.neighbours = GetNeighbours<Ball>(ball);
                    ball.Flags &= ~EBallFlags.DirtyToCheckNeighbours;
                }
            }
        }
        #endregion
        
        public static void UpdateNeighbours(Ball ball)
        {
            for (int i = 0; i < ball.neighbours.Length; i++)
            {
                var ballNeighbour = ball.neighbours[i];
                if (ballNeighbour != null)
                {
                    ballNeighbour.Flags |= EBallFlags.DirtyToCheckNeighbours;
                    ballNeighbour.neighbours = GetNeighbours<Ball>(ballNeighbour);
                }
            }
        }

        public static HashSet<Ball> GetConnectedBalls(Level level, EBallFlags filterFlags = EBallFlags.None)
        {
            if(ballsWithNeighbours == null)
                ballsWithNeighbours = new HashSet<Ball>(level.sizeX * level.sizeY);
            else
                ballsWithNeighbours.Clear();

            foreach (var ball in Ball.RootBalls)
            {
                if (ball is null || (ball.Flags & EBallFlags.MarkConnected) != 0)
                    continue;

                if ((ball.Flags & EBallFlags.Pinned) == 0)
                    continue;

                // Check if the level type is rotating and the ball has certain properties
                if (level.levelType == ELevelTypes.Rotating && !ball.AnyValidNeighbour())
                {
                    bool anyValid = false;
                    foreach (var ballNeighbour in ball.neighbours)
                    {
                        if (ballNeighbour != null && ballNeighbour.AnyValidNeighbour())
                            anyValid = true;
                    }

                    if (!anyValid)
                        continue;
                }

                // Check if the ball is pinned, a root ball, and not already in the set
                if ((ball.Flags & EBallFlags.Pinned) != 0 && !ballsWithNeighbours.Contains(ball))
                {
                    FindConnectedBalls(ball, ballsWithNeighbours, filterFlags);
                }
            }

            return ballsWithNeighbours;
        }

        /// find connected balls
        private static void FindConnectedBalls(Ball ball, HashSet<Ball> matchList, EBallFlags filterFlags)
        {
            ball.Flags |= EBallFlags.MarkConnected;
            matchList.Add(ball);
            foreach (var ballNext in ball.neighbours)
            {
                if (ballNext == null)
                    continue;
                if(filterFlags != EBallFlags.None && (ballNext.Flags & filterFlags) != 0)
                    continue;
                if((ballNext.Flags & EBallFlags.MarkConnected) == 0 && (ballNext.Flags & EBallFlags.Pinned) != 0 && !matchList.Contains(ballNext))
                {
                    FindConnectedBalls(ballNext, matchList, filterFlags);
                }
            }
        }

        public static void ClearMarks(List<List<Ball>> balls)
        {
            for (int y = 0; y < balls.Count; y++)
            {
                for (int x = 0; x < balls[y].Count; x++)
                {
                    var ball = balls[y][x];
                    if (ball != null)
                    {
                        ball.Flags &= ~EBallFlags.MarkConnected;
                        ball.Flags &= ~EBallFlags.MarkedForDestroy;
                    }
                }
            }
        }
    }
}