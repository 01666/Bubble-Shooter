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

using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
    /// Fader class for fading the screen when a popup is shown
    public class Fader : MonoBehaviour
    {
        private Image fader;
        private bool fadeIn;
        private readonly float fadeTime = .5f;
        private float currentAlpha = 0f;
        public float minValue = 0;
        public float maxValue = .8f;

        private void Awake()
        {
            fader = GetComponent<Image>();
        }

        public bool IsFaded()
        {
            return currentAlpha >= maxValue;
        }

        public void FadeIn()
        {
            fadeIn = true;
            if (fader != null)
            {
                fader.gameObject.SetActive(true);
            }
        }

        public void FadeOut()
        {
            fadeIn = false;
        }
        
        void Update() {
            if (fadeIn) {
                currentAlpha += Time.deltaTime / fadeTime;
            } else {
                currentAlpha -= Time.deltaTime / fadeTime;
            }
            currentAlpha = Mathf.Clamp(currentAlpha, minValue, maxValue);
            fader.raycastTarget = currentAlpha > 0;
            fader.color = new Color(fader.color.r, fader.color.g, fader.color.b, currentAlpha);
        }

        public void FadeAfterLoadingScene()
        {
            currentAlpha = 1f;
            FadeOut();
        }
    }
}