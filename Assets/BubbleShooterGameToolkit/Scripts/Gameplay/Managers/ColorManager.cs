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

using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

#endregion

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    /// color generator
    public class ColorManager : Singleton<ColorManager>
    {
        //to know what colors in game and how many
        private Dictionary<int, int> colors = new();
        private readonly Queue<int> lastGeneratedColors = new Queue<int>();
        private readonly int maxRepeatedColors = 3; // Maximum times a color can be repeated consecutively
        
        public override void Init()
        {
            base.Init();
            colors = new Dictionary<int, int>();
        }
        
        /// generate available color which exists on the level
        public int GenerateColor()
        {
            if (colors.Values.Sum() < 20)
            {
                CorrectColors();
            }
            var weightedList = new List<int>();
            foreach (var pair in colors)
            {
                for (int i = 0; i < pair.Value; i++)
                {
                    weightedList.Add(pair.Key);
                }
            }

            int generateColor = Random.Range(0,3);
            if(weightedList.Count > 0 && (EventManager.GameStatus == EStatus.Play || EventManager.GameStatus == EStatus.Tutorial))
            {
                int attempts = 0;
                do
                {
                    int generateColorIndex = Random.Range(0, weightedList.Count);
                    generateColor = weightedList[generateColorIndex];
                    attempts++;
                }
                while (lastGeneratedColors.Contains(generateColor) && lastGeneratedColors.Count >= maxRepeatedColors && attempts < weightedList.Count);

                // Update the queue of last generated colors
                if (lastGeneratedColors.Count >= maxRepeatedColors)
                {
                    lastGeneratedColors.Dequeue();
                }
                lastGeneratedColors.Enqueue(generateColor);
            }

            return generateColor;
        }

        private void CorrectColors()
        {
            colors.Clear();

            var allColorBalls = GameObject.FindObjectsOfType<ColorBall>().Where(i => i != null && i.gameObject.activeSelf && (i.Flags & EBallFlags.Pinned) != 0);

            foreach (var colorBall in allColorBalls)
            {
                int color = colorBall.GetColor();
                AddColor(color);
            }
        }

        public void AddColor(int color)
        {
            if (colors.ContainsKey(color))
                colors[color] += 1;
            else
            {
                colors.Add(color, 1);
            }
            
            if(!colors.ContainsKey(color) || colors[color] < 20)
            {
                colors.TryAdd(color, CalculateColorAmount(color));
            }
        }

        public void RemoveColor(int color)
        {
            if (colors.ContainsKey(color))
            {
                colors[color]--;
                if (colors[color] <= 0)
                {
                    colors.Remove(color);
                    EventManager.GetEvent<int>(EGameEvent.ColorRemoved).Invoke(color);
                }
            }
            if(!colors.ContainsKey(color) || colors[color] < 20)
            {
                colors.TryAdd(color, CalculateColorAmount(color));
            }
        }
        
        private int CalculateColorAmount(int color)
        {
            var count = GameObject.FindObjectsOfType<ColorBall>().Where(i => i != null && i.gameObject.activeSelf && (i.Flags & EBallFlags.Pinned) != 0 && i.GetColor() == color).Count();
            return count;
        }

        public bool AnyColorExists() => colors.Count > 0;
    }
}