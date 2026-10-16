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
using BubbleShooterGameToolkit.Scripts.Gameplay.Animations;
using BubbleShooterGameToolkit.Scripts.Gameplay.GUI;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects;
using BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels;
using BubbleShooterGameToolkit.Scripts.Gameplay.Pool;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Managers
{
    public class ScoreManager : SingletonBehaviour<ScoreManager>
    {
        private int score;
        private int _comboCount;
        private Queue<int> multiplierQueue = new Queue<int>();
        private bool showScorePopup;
        private AnimationCurve curve;

        private void OnEnable()
        {
            showScorePopup = GameManager.instance.GameplaySettings.showScorePopup;
            curve = GameManager.instance.GameplaySettings.ScoreMultiplierCurve;
        }

        public void SetScore(int score)
        {
            this.score = score;
            GameUIManager.instance?.UpdateScore(score);
        }
        
        public void SetCombo(int comboCount)
        {
            _comboCount = comboCount;
        }
        
        public void AddScore(int scoreUpdated, Vector3 pos, bool considerCombo = true)
        {
            var aggregate = multiplierQueue.Count > 0 ? multiplierQueue.Aggregate((a, b) => a * b) : 1;
            var updated = scoreUpdated * (considerCombo ? (int)curve.Evaluate(_comboCount) : 1) * aggregate;
            score += (int) updated;
            GameUIManager.instance.UpdateScore(score);
            if(showScorePopup)
                AnimateScore(updated, pos, aggregate > 1? "ScoreBig" : "Score");
        }

        public int GetScore() => score;

        private void AnimateScore(int scoreTXT, Vector3 pos, string prefabName)
        {
            var sc = PoolObject.GetObject(prefabName);
            sc.transform.position = pos.SnapZ();
            sc.GetComponent<ScoreAnim>().StartAnim(scoreTXT.ToString());
        }

        public void CheckMultiplier(Ball[] balls)
        {
            var multi = balls.Sum(i=> i?.label is ExtraScore label ? label.scoreMultiplier : 0);
            if(multi > 0)
                SetMultiplier(multi);
        }

        public void SetMultiplier(int multi)
        {
            this.multiplierQueue.Enqueue(multi);
            Invoke(nameof(DequeueMultiplier), 2);
        }
        
        void DequeueMultiplier()
        {
            multiplierQueue.Dequeue();
        }
    }
}