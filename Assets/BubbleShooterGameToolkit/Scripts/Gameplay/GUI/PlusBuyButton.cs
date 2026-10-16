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

using TMPro;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.GUI
{
    public class PlusBuyButton : CustomButton
    {
        public TextMeshProUGUI plusIcon;

        protected override void OnEnable()
        {
            base.OnEnable();
            plusIcon = GetComponentInChildren<TextMeshProUGUI>();
        }

        public override bool IsInteractable()
        {
            var isInteractable = base.IsInteractable();
            if (plusIcon != null)
            {
                plusIcon.color = isInteractable ? new Color(59f / 255f, 53f / 255f, 63f / 255f) : new Color(135f / 255f, 133f / 255f, 136f / 255f);
            }

            return isInteractable;
        }
    }
}