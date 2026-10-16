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

using BubbleShooterGameToolkit.Scripts.System;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class LifeShop : PopupWithCurrencyLabel
    {
        public Button buyLifeButton;
        
        [SerializeField] private Transform iconPos;

        private void OnEnable()
        {
            buyLifeButton.onClick.AddListener(BuyLife);
            buyLifeButton.GetComponentInChildren<TextMeshProUGUI>().text = GameManager.instance.GameSettings.refillLifeCost.ToString();
        }

        private void BuyLife()
        {
            if(GameManager.instance.coins.Consume(GameManager.instance.GameSettings.refillLifeCost))
            {
                ShowCoinsSpendFX(buyLifeButton.transform.position);
                GetLife();
            }
        }

        public void GetLife()
        {
            var lifeDefaultValue = GameManager.instance.life.GetResource();
            DOVirtual.DelayedCall(0.5f, () => AnimLife(lifeDefaultValue));
            GameManager.instance.life.RestoreLifes();
            result = EPopupResult.Continue;
        }

        private void AnimLife(int value)
        {
            topPanel.AnimateLife(iconPos.position, "", () => base.Close());
        }
    }
}