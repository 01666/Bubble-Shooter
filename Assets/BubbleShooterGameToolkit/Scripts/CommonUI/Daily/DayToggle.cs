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

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Daily
{
    public class DayToggle : MonoBehaviour
    {
        [SerializeField]
        public Material grayscaleMaterial;

        [SerializeField]
        private Sprite passed;

        [SerializeField]
        private Sprite current;

        private Material defaultMaterial;
        public Image imageComponent;

        private void Awake()
        {
            imageComponent = GetComponent<Image>();
            defaultMaterial = imageComponent.material; 
        }

        public void SetStatus(EDailyStatus eDailyStatus)
        {
            imageComponent.material = eDailyStatus == EDailyStatus.locked ? grayscaleMaterial : defaultMaterial;var imageComponentSprite = eDailyStatus == EDailyStatus.current ? current : passed;
            if (imageComponentSprite != null)
            {
                imageComponent.sprite = imageComponentSprite;
            }
        }
    }

    public enum EDailyStatus
    {
        locked,
        passed,
        current
    }
}