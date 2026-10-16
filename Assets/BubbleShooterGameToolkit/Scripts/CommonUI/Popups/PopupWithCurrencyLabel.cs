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
using UnityEngine;
using UnityEngine.Assertions;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    public class PopupWithCurrencyLabel : Popup
    {
        [SerializeField]
        private GameObject topPanelPrefab;
        protected TopPanel topPanel;

        protected override void Awake()
        {
            Assert.IsNotNull(topPanelPrefab, "top panel prefab is null");
            topPanel = Instantiate(topPanelPrefab, transform.parent).GetComponent<TopPanel>();
            topPanel.gameObject.SetActive(false);
            base.Awake();
        }

        public override void AfterShowAnimation()
        {
            topPanel.gameObject.SetActive(true);
            base.AfterShowAnimation();
        }

        public override void Close()
        {
            base.Close();
            Destroy(topPanel.gameObject);
        }

        protected void ShowCoinsSpendFX(Vector3 position)
        {
            SoundBase.instance.PlaySound(SoundBase.instance.coinsSpend);
            var fx = Instantiate(Resources.Load<GameObject>("FX/CoinsSpendFX"), position, Quaternion.identity, transform.parent);
            fx.transform.localScale = Vector3.one;
        }
    }
}