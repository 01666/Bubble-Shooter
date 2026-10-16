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

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Attachables.Labels
{
    public class RandomDestructor : LabelItem
    {
        private Vector3 center;

        public override void OnEnable()
        {
            base.OnEnable();
            center = transform.localPosition;
        }

        private void Update()
        {
            transform.localPosition = center + new Vector3(Mathf.Sin(-Time.time * 2), Mathf.Cos(-Time.time * 2), 0) * .2f;
            transform.localRotation = Quaternion.Euler(0, 0, Time.time * 100);
        }

        public override void SetPosition(Vector3 transformPosition)
        {
            transform.position = ball.transform.position + new UnityEngine.Vector3(.2f, .2f, 0);
            transform.localRotation = UnityEngine.Quaternion.Euler(0, 0, 30);
        }
    }
}