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
using BubbleShooterGameToolkit.Scripts.Gameplay.Managers;
using BubbleShooterGameToolkit.Scripts.LevelSystem;
using BubbleShooterGameToolkit.Scripts.System;
using BubbleShooterGameToolkit.Scripts.Utils;
using Unity.Mathematics;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.PlayObjects.Types
{
    public class RotatingLevelBall : SingletonBehaviour<RotatingLevelBall>
    {
        float angle;
        private Rigidbody2D rb;
        public int rotatingField = 3;
        private Transform rotationTransform;
        private Quaternion newRot;

        void Start()
        {
            rotationTransform = new GameObject("Rotation").transform;
            rotationTransform.SetParent(transform.parent);
            GetComponent<Ball>().Flags |= EBallFlags.Root;
            transform.localScale *= 1.2f;
            LevelUtils.CleanUpBallsForRotatingLevel(GetRotationParent(), LevelManager.instance.balls);
            transform.SetParentPosition(transform.position);
            rb = rotationTransform.gameObject.AddComponent<Rigidbody2D>();
            rb.angularDrag = 1;
            rb.constraints = RigidbodyConstraints2D.FreezePositionX | RigidbodyConstraints2D.FreezePositionY;
            rotationTransform.rotation = quaternion.Euler(0,0,0);
            LevelManager.instance.ball_center_pivot = transform;
        }

        public Transform GetRotationParent() => rotationTransform;

        public void Rotate(Vector3 ballPosition)
        {
            var direction = rotationTransform.position;

            angle = Vector2.Angle(direction - ballPosition, ballPosition - transform.position) / 4f;

            if (transform.position.x < ballPosition.x)
                angle *= -1;

            newRot = transform.rotation * Quaternion.AngleAxis(angle, Vector3.back);

            SoundBase.instance.GetComponent<AudioSource>().PlayOneShot(SoundBase.instance.rotation);
        }
        
        void Update()
        {
            if( rotationTransform.rotation != newRot )
                rotationTransform.rotation = Quaternion.Lerp( rotationTransform.rotation, newRot, Time.deltaTime);
        }

        public bool IsRotating()
        {
            return Mathf.Abs(rotationTransform.rotation.eulerAngles.z - newRot.eulerAngles.z) > 1.0f;
        }
    }
}