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
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.ExtraItems;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.System;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class MatchingManager
    {
        private readonly List<Ball> matchList;
        private static int MatchSettingsCount = 3;
        public MatchingManager()
        {
            matchList = new List<Ball>();
            MatchSettingsCount = GameManager.instance.GameSettings.matchSettingsCount;
        }
        
        public int CheckMatch(ColorBall ball)
        {
            matchList.Clear();
            ProcessBall(ball, MatchSettingsCount);
            if (matchList.Count >= MatchSettingsCount)
            {
                EventManager.GetEvent<object>(EGameEvent.ToDestroy).Invoke(matchList);
            }
            ClearMarks();
            return matchList.Count;
        }

        private void ProcessBall(ColorBall ball, int matchSettingsCount)
        {
            if (ball is Multicolor multicolorBall)
            {
                ProcessMulticolorBall(multicolorBall, matchSettingsCount);
            }
            else
            {
                AddToMatchList(ball, matchSettingsCount);
            }
        }

        private void ProcessMulticolorBall(Multicolor multicolorBall, int matchSettingsCount)
        {
            foreach (var neighbour in multicolorBall.neighbours)
            {
                if (neighbour is ColorBall colorBall)
                {
                    AddToMatchList(colorBall, matchSettingsCount);
                    if (matchList.Count >= matchSettingsCount) break;
                }
            }
        }

        private void AddToMatchList(ColorBall ball, int matchSettingsCount)
        {
            ball.Flags |= EBallFlags.MarkedForMatch;
            matchList.Add(ball);
            FindMatches(matchList, ball, ball.GetColor());
            if (matchList.Count < matchSettingsCount)
            {
                ClearMarks();
                matchList.Clear();
            }
        }

        private void ClearMarks()
        {
            foreach (var ball in matchList)
            {
                ball.Flags &= ~EBallFlags.MarkedForMatch;
            }
        }

        private void FindMatches(List<Ball> matchList, Ball ball, int color)
        {
            foreach (var ballNext in ball.neighbours)
            {
                if (ballNext is ColorBall colorBall && colorBall.CompareColor(color) && (colorBall.Flags & EBallFlags.MarkedForMatch) == 0
                    && colorBall.cover is not { isProtectingBall: true })
                {
                    colorBall.Flags |= EBallFlags.MarkedForMatch;
                    matchList.Add(colorBall);
                    FindMatches(matchList, colorBall, color);
                }
            }
        }
        
        public List<Ball> GetMatchList(ColorBall ball, int matchSettingsCount)
        {
            matchList.Clear();
            ProcessBall(ball, matchSettingsCount);
            ClearMarks();
            return matchList;
        }
    }
}