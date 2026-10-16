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
using BubbleShooterGameToolkit.Scripts.Gameplay.Boosts;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.BubbleContainers
{
    /// Draw aim line with dots
    public class AimLine : MonoBehaviour
    {
        [SerializeField]
        private GameObject dotPrefab;
        [SerializeField]
        private GameObject bigDotPrefab;

        private AimDot[] dots = new AimDot[40];

        public bool aimBoostSelected;
        private AimDot bigDot;
        private int usedDots;
        private SpriteRenderer bigSpriteRenderer;
        private const int maxDotsToCollider = 20;

        private void Start()
        {
            for (int i = 0; i < dots.Length; i++)
            {
                dots[i] = CreateDot();
            }
            bigDot = Instantiate(bigDotPrefab, transform.position, Quaternion.identity, transform).GetComponent<AimDot>();
            bigDot.animate = false;
            bigSpriteRenderer = bigDot.GetComponentInChildren<SpriteRenderer>();
            HidePoints();
        }

        private AimDot CreateDot()
        {
            return Instantiate(dotPrefab, transform.position, Quaternion.identity, transform).GetComponent<AimDot>();
        }

        private void OnEnable()
        {
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostActivated).Subscribe(OnBoostActivated);
        }

        private void OnDisable()
        {
            EventManager.GetEvent<BoostResource>(EGameEvent.BoostActivated).Unsubscribe(OnBoostActivated);
        }

        private void OnBoostActivated(BoostResource obj)
        {
            if (obj is AimBoostResource)
            {
                aimBoostSelected = true;
                EventManager.GetEvent<BoostResource>(EGameEvent.BoostActivated).Unsubscribe(OnBoostActivated);
            }
        }

        public void DrawAimLine(Color color, List<RaycastHit2D> hits, Vector2Int positionNearBall)
        {
            CheckDotsLength(hits);
            
            DrawDots(transform.position, hits, color);

            if (aimBoostSelected && positionNearBall.magnitude > 0)
            {
                bigDot.transform.position = LevelUtils.PosToWorld(positionNearBall);
                bigDot.Show();
                if(hits[^1].transform.GetComponent<AbsorbingBall>())
                    bigSpriteRenderer.color = Color.red;
                else
                    bigSpriteRenderer.color = Color.white;
            }
            else
            {
                bigDot.Hide();
            }

            var f = 1f;
            var minScale = 0.2f;
            var prevScale = f;

            for (var i = 0; i <= Mathf.Clamp(usedDots, 0, dots.Length - 1); i++)
            {
                // Scale down every next dot.
                var scale = Mathf.Max(f - i / (float)usedDots * f, minScale);
                dots[i].SetScaleAnimation(new Vector3(scale, scale, 1), prevScale);
                prevScale = scale;
            }

            // Hide the rest of dots.
            var j = aimBoostSelected? usedDots : 5;
            for (; j < dots.Length; j++)
            {
                dots[j]?.Hide();
            }
        }

        private void CheckDotsLength(List<RaycastHit2D> hits)
        {
            var dotsToCollider = (hits.Count - 1)  * maxDotsToCollider;
            if (dotsToCollider > dots.Length)
            {
                var newDots = dotsToCollider - dots.Length;
                Array.Resize(ref dots, dotsToCollider);
                for (int i = newDots; i < dots.Length; i++)
                {
                    if (dots[i] == null)
                        dots[i] = CreateDot();
                }
            }
        }

        private void DrawDots(Vector2 start, List<RaycastHit2D> hits, Color color)
        {
            usedDots = 0;
            int h = 0;

            var second = hits[h].centroid;
            Vector2 v = (second - start).normalized;
            var dist = Vector2.Distance(start, second);
            var distBetweenDots = 1.0f;
            var fraqDist = Vector2.Distance(start, start + v * (1 * distBetweenDots));
            var distDots = 0f;
            int i = 0;
            float limit = dots.Length;
            float totalDist = 0f;
            if (!aimBoostSelected)
                limit = 7;
            for (i = 0; i < dots.Length && totalDist <= limit; i++)
            {
                SetDot(i == 0 ? start : start + v * (i * distBetweenDots), start + v * ((i + 1) * distBetweenDots), color, i, v);
                distDots += fraqDist;
                totalDist += fraqDist;
                if (distDots > dist)
                    break;
            }

            usedDots += i;
            for (h = 1; h < hits.Count; h++)
            {
                second = hits[h-1].centroid;
                var end = hits[h].centroid;
                dist = Vector2.Distance(second, end);
                v = (end - second).normalized;
                distDots = 0f;
                for (i = 0; i < maxDotsToCollider && totalDist <= limit; i++)
                {
                    SetDot(second + v * (i * distBetweenDots), second + v * ((i + 1) * distBetweenDots), color, usedDots + i, v);
                    distDots += fraqDist;
                    totalDist += fraqDist;
                    if (distDots > dist)
                        break;
                }
                usedDots += i;
            }
        }

        private void SetDot(Vector2 start, Vector2 nextPoint, Color color, int i, Vector2 v)
        {
            if (i >= dots.Length)
                return;
            var aimDot = dots[i];
            if (aimDot == null)
                return;
            aimDot.transform.position = start;
            aimDot.UpdateAnimation(aimDot.transform.position, nextPoint);
            aimDot.SetColor(color);
            if(!aimDot.IsShow)
                aimDot.Show();
        }

        public void HidePoints()
        {
            for (var i = 0; i < dots.Length; i++)
            {
                dots[i]?.Hide();
            }
            bigDot.Hide();
        }
    }
}