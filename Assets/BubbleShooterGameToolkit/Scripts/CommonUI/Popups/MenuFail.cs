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

using BubbleShooterGameToolkit.Scripts.Audio;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class MenuFail : Popup
    {
        [SerializeField]
        private TextMeshProUGUI scoreText;
        
        [SerializeField]
        public Button againButton;

        private void OnEnable()
        {
            closeButton.onClick.AddListener(GoMap);
            againButton.onClick.AddListener(Again);
            scoreText.text = $"Score: <color=#FFFFFF>{ScoreManager.instance.GetScore() }</color>";
        }

        public override void ShowAnimationSound()
        {
            base.ShowAnimationSound();
            SoundBase.instance.PlayDelayed(SoundBase.instance.failed,.2f);
        }

        private void GoMap()
        {
            OnCloseAction =(_)=> SceneLoader.instance.GoToMap();
            Close();
        }
        
        private void Again()
        {
            OnCloseAction = (_) => GameManager.instance.RestartLevel();
            Close();
        }
    }
}