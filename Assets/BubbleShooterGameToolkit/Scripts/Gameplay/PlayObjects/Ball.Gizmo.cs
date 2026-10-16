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

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    public partial class Ball
    {
        private void OnDrawGizmosSelected()
        {
            if(!Application.isPlaying)
                return;
            Gizmos.color = new Color(1, 1, 0, 0.5f);
            Gizmos.DrawSphere(transform.position, 0.4f);
            
            // mark neighbours
            Gizmos.color = Color.green;
            for (int i = 0; i < neighbours.Length; i++)
            {
                if (neighbours[i] != null)
                {
                    Gizmos.DrawLine(transform.position, neighbours[i].transform.position);
                }
            }
        }
        
        #if UNITY_EDITOR
        void OnDrawGizmos() 
        {
            if(!Application.isPlaying)
                return;
            UnityEditor.Handles.Label(transform.position+ Vector3.one*0.1f, (position.x + ":" + position.y));
            UnityEditor.Handles.color = Color.white;
        }
        #endif
    }
}