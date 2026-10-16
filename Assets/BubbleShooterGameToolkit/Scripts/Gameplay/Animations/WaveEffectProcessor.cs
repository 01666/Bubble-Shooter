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

using System.Collections;
using System.Collections.Generic;
using System.Linq;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using DG.Tweening;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Animations
{
    public class WaveEffectProcessor : SingletonBehaviour<WaveEffectProcessor>
    {
        public void AnimateWaveEffect(Ball ballLaunched, Vector3 stopPos, int maxLayers, float waveRadius, float waveDuration, float delayBetweenLayers, float delayBeforeStart)
        {
            StartCoroutine(AnimateWaveEffect(ballLaunched, stopPos, maxLayers, waveRadius, waveDuration, delayBetweenLayers, .05f, delayBeforeStart));
        }

        public IEnumerator AnimateWaveEffect(Ball ballLaunched, Vector3 stopPos, int maxLayers, float waveRadius, float waveDuration, float delay, float attenuation, float delayBeforeStart = 0)
        {
            Vector3 waveOrigin = stopPos;
            var currentLayerBalls = LevelUtils.GetNeighbours<Ball>(ballLaunched).ToList();
            List<Ball> nextLayerBalls = new List<Ball>();
            for (int layer = maxLayers; layer > 0 && currentLayerBalls.Count > 0; layer--)
            {
                foreach (Ball ball in currentLayerBalls)
                {
                    if (ball == null || (ball.Flags & EBallFlags.Animating) != 0)
                        continue;

                    Transform firstChild;
                    if (ball.transform.childCount > 0)
                        firstChild = ball.transform.GetChild(0);
                    else
                        continue;

                    ball.Flags |= EBallFlags.Animating;
                    Vector3 localWaveOrigin = ball.transform.InverseTransformPoint(waveOrigin);
                    Vector3 direction = (firstChild.localPosition - localWaveOrigin).normalized;
                    Sequence sequence = DOTween.Sequence();
                    sequence.AppendInterval(delayBeforeStart);
                    sequence.Append(firstChild.DOLocalMove(firstChild.localPosition + direction * waveRadius, waveDuration));
                    sequence.Append(firstChild.DOLocalMove(Vector3.zero, waveDuration)).OnComplete(() => ball.Flags &= ~EBallFlags.Animating);
                    var neighbours = ball.neighbours;
                    foreach (var neighbour in neighbours)
                    {
                        if (neighbour != null && !nextLayerBalls.Contains(neighbour) && !currentLayerBalls.Contains(neighbour))
                        {
                            nextLayerBalls.Add(neighbour);
                        }
                    }
                }

                yield return new WaitForSeconds(delay);
                currentLayerBalls = nextLayerBalls;
                nextLayerBalls = new List<Ball>();
                waveRadius -= attenuation;
                if (waveRadius < 0)
                    waveRadius = 0;
            }
        }
    }
}