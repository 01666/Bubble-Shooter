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

using BubbleShooterGameToolkit.Scripts.Utils;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects
{
    // Class to handle the ball's collision with the screen bounds and the ball's movement
    public class BallColliderHandler
    {
        private Rigidbody2D _rb;
        private readonly CircleCollider2D _collider2D;

        // Constructor, initialize the components
        public BallColliderHandler(CircleCollider2D collider2D)
        {
            _collider2D = collider2D;
        }

        /// Set object into a static state with enabled collider
        public void SetKinematic(Ball ball, bool launched = false)
        {
            if(launched)
            {
                _rb = ball.gameObject.AddComponentIfNotExists<Rigidbody2D>();
            }

            if (_rb != null)
            {
                _rb.bodyType = RigidbodyType2D.Kinematic;
            }

            _collider2D.enabled = true;
            _collider2D.isTrigger = true;
            _collider2D.radius = launched ? 0.4f : 0.7f;
        }
        
        // disable collider
        public void DisableCollider()
        {
            if (_rb != null)
            {
                _rb.bodyType = RigidbodyType2D.Kinematic;
            }

            _collider2D.enabled = false;
        }

        /// Set object into a dynamic state to fall
        public void SetDynamic(Ball ball)
        {
            _rb = ball.gameObject.AddComponentIfNotExists<Rigidbody2D>();
            _rb.bodyType = RigidbodyType2D.Dynamic;
            _rb.gravityScale = 2.5f;
            _collider2D.enabled = true;
            _collider2D.isTrigger = false;
        }
        
        public bool IsColliderEnabled()=>_collider2D.enabled;


        public void AddForce(Vector2 vector2)
        {
            _rb.AddForce(vector2);
        }
    }
}