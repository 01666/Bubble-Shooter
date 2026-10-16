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
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.Gameplay.Targets;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    public class GameUIManager : SingletonBehaviour<GameUIManager>
    {
        [SerializeField] private TextMeshProUGUI scoreUI;
        [SerializeField] private TextMeshProUGUI movesUI;
        [SerializeField] private ScoreBar scoreBar;
        [SerializeField] private TargetContainerUI targetContainerUI;
        [SerializeField] private Button pauseButton;

        [SerializeField]
        private Color colorWarningMoves;

        private Tweener pulseSequence;
        public static Action<int, bool> OnMovesUpdated;
        private bool soundPlayed;

        public override void Awake()
        {
            base.Awake();
            // Setup a pulse sequence
            pulseSequence = movesUI.transform.DOScale(1.5f, 1.5f)
                .SetLoops(-1, LoopType.Yoyo).SetEase(Ease.InOutSine);
            pulseSequence.Pause();
        }

        private void OnEnable()
        {
            pauseButton.onClick.AddListener(Pause);
        }

        private static void Pause()
        {
            if (EventManager.GameStatus == EStatus.Play)
                EventManager.SetGameStatus(EStatus.Pause);
        }

        public void InitScoreAndTarget(int[] stars, Level level, LevelManager levelManager)
        {
            scoreBar.InitProgress(stars);
            var list = targetContainerUI.PrepareTargets(level.targets);
            for (var i = 0; i < level.targets.Count; i++)
            {
                var levelTarget = level.targets[i];
                var hashCode = levelTarget.target.prefab.name.GetHashCode();
                TargetManager.instance._targetObjectControllers.Add(new TargetObjectController(levelTarget, list[i], levelTarget.count, hashCode, levelManager));
            }
        }

        public void UpdateScore(int score)
        {
            scoreUI.text = score.ToString();
            scoreBar.UpdateProgress(score);
        }
        
        public void UpdateMoves(int moves)
        {
            if(moves <= 0 && EventManager.GameStatus == EStatus.Win)
                Hide();
            bool isTimeMode = LevelLoader.instance.CurrentLevel.levelMode == ELevelMode.Time;

            // format seconds to 00:00 format like time if in Time mode, otherwise just convert moves to string
            movesUI.text = isTimeMode ? TimeSpan.FromSeconds(moves).ToString(@"mm\:ss") : moves.ToString();

            int warningThreshold = isTimeMode ? GameManager.instance.GameplaySettings.warningTimeThreshold : GameManager.instance.GameplaySettings.warningMovesThreshold;

            var thresholdReached = moves <= warningThreshold;
            if (EventManager.GameStatus == EStatus.Play)
            {
                if (thresholdReached)
                {
                    movesUI.color = colorWarningMoves;

                    // Start the pulse if it's not already playing
                    if (!pulseSequence.IsPlaying())
                    {
                        pulseSequence.Play();
                        if(!soundPlayed)
                        {
                            soundPlayed = true;
                            if (isTimeMode)
                                SoundBase.instance.PlaySound(SoundBase.instance.warningTime);
                            else
                                SoundBase.instance.PlaySound(SoundBase.instance.warningMoves);
                        }
                    }
                }
                else
                {
                    movesUI.color = Color.white;
                    if (pulseSequence != null && pulseSequence.IsPlaying())
                    {
                        pulseSequence.Restart();
                        pulseSequence.Pause();
                    }
                }
            }
            
            OnMovesUpdated?.Invoke(moves, thresholdReached);
        }

        private void OnDisable()
        {
            pauseButton.onClick.RemoveListener(Pause);
            pulseSequence.Kill();
        }

        private void Hide()
        {
            movesUI.transform.parent.gameObject.SetActive(false);
        }
    }
}