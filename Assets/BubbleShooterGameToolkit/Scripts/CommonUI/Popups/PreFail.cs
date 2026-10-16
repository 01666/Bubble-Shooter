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

using BubbleShooterGameToolkit.Scripts.Enums;
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class PreFail : PopupWithCurrencyLabel
    {
        [SerializeField]
        public Button continueButton;
        [SerializeField] private TextMeshProUGUI amountMovesText;
        [SerializeField] private TextMeshProUGUI[] amoutMoves;

        private void OnEnable()
        {
            int moves = LevelManager.instance?.Level?.levelMode == ELevelMode.Moves? GameManager.instance.GameSettings.movesContinue : GameManager.instance.GameSettings.timeContinue;
            amountMovesText.text = LevelManager.instance?.Level?.levelMode == ELevelMode.Moves?  $"Continue with <color=#FFFF70>+{moves}</color> bubbles?" : $"Continue with <color=#FFFF70>+{moves}</color> seconds extra?";
            amoutMoves[0].text = "+" + moves;
            amoutMoves[1].text = "+" + moves;
            continueButton.GetComponentInChildren<TextMeshProUGUI>().text = GameManager.instance.GameSettings.continuePrice.ToString();
            continueButton.onClick.AddListener(KeepPlaying);
            closeButton.onClick.AddListener(RefuseToContinue);
        }

        void KeepPlaying()
        {
            if (GameManager.instance.coins.Consume(GameManager.instance.GameSettings.continuePrice) )
            {
                Continue();
            }
        }

        public void Continue()
        {
            ShowCoinsSpendFX(continueButton.transform.position);
            result = EPopupResult.Continue;
            Close();
        }

        void RefuseToContinue()
        {
            result = EPopupResult.Cancel;
            Close();
        }
    }
}