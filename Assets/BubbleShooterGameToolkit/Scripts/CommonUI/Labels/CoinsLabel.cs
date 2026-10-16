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

using BubbleShooterGameToolkit.Scripts.CommonUI.Popups;
using BubbleShooterGameToolkit.Scripts.System;
using DG.Tweening;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Labels
{
    public class CoinsLabel : Label
    {
        public Button buyButton;
        private Tweener doPunchScale;

        [SerializeField]
        private TextMeshProUGUI coisTextPrefab;

        private void OnEnable()
        {
            UpdateLabel(GameManager.instance.coins.GetResource());
            GameManager.instance.coins.OnResourceUpdate += UpdateLabel;
            buyButton?.onClick.AddListener(Buy);
        }

        private void OnDisable()
        {
            if (GameManager.instance != null)
            {
                GameManager.instance.coins.OnResourceUpdate -= UpdateLabel;
            }
        }

        private void UpdateLabel(int count)
        {
            label.text = count.ToString();
        }

        public void Buy()
        {
            var coinsShop = MenuManager.instance.ShowPopup<CoinsShop>();
            // coinsShop.OnAfterCloseAction += () => buyButton.interactable = true;
        }

        
    }
}