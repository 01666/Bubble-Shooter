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
using BubbleShooterGameToolkit.Scripts.Audio;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    public class CustomButton : Button
    {
        private bool isClicked;
        private readonly float cooldownTime = 2f; // Cooldown time in seconds

        protected override void Awake()
        {
            base.Awake();
            transition = Transition.None;
        }

        public override void OnPointerClick(PointerEventData eventData)
        {
            if (isClicked)
            {
                return;
            }

            isClicked = true;
            base.OnPointerClick(eventData);
            SoundBase.instance.PlaySound(SoundBase.instance.click);

            // Start cooldown
            if (gameObject.activeInHierarchy)
            {
                StartCoroutine(Cooldown());
            }
        }

        private IEnumerator Cooldown()
        {
            yield return new WaitForSeconds(cooldownTime);
            isClicked = false;
        }
    }
}