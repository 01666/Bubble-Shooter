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

using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace BubbleShooterGameToolkit.Scripts.LevelSystem
{
    [Serializable]
    public struct SpriteStruct
    {
        [SerializeField] public Sprite sprite;
        [SerializeField] public Vector3 localPos;
        [SerializeField] public Vector3 localScale;
        [SerializeField] private Bounds localBounds;
        [SerializeField] private Bounds spriteBounds;
        [SerializeField] public float eulerAnglesZ;
        [SerializeField] private Vector3 globalScale;

        public SpriteStruct(SpriteRenderer spriteRenderer, Bounds bounds, Sprite sprite, Transform topmostParent)
        {
            this.sprite = sprite;
            spriteBounds = sprite.bounds;
            // Translate world position to the local space of the topmost parent
            localPos = topmostParent.InverseTransformPoint(spriteRenderer.transform.position);
            localScale = spriteRenderer.transform.localScale;
            localBounds = bounds;
            if (spriteRenderer.flipX) localScale.x *= -1;
            if (spriteRenderer.flipY) localScale.y *= -1;
            eulerAnglesZ = spriteRenderer.transform.eulerAngles.z;
            Matrix4x4 matrix = spriteRenderer.transform.localToWorldMatrix;
            globalScale = new Vector3(
                matrix.GetColumn(0).magnitude, 
                matrix.GetColumn(1).magnitude, 
                matrix.GetColumn(2).magnitude);
        }

        public Image GetImage(float squareSize)
        {
            Image image = new Image();
            image.image = sprite.texture;

            image.style.position = Position.Absolute;
            image.style.color = Color.clear;

            float normalizedLocalPosX = (localPos.x - localBounds.min.x) / localBounds.size.x;
            float normalizedLocalPosY = (localPos.y - localBounds.min.y) / localBounds.size.y; 

            float imageWidth = spriteBounds.size.x / localBounds.size.x * squareSize * globalScale.x;
            float imageHeight = spriteBounds.size.y / localBounds.size.y * squareSize * globalScale.y;

            float leftPosition = normalizedLocalPosX * squareSize - imageWidth / 2.0f;
            float topPosition = normalizedLocalPosY * squareSize - imageHeight / 2.0f;

            image.style.left = leftPosition;
            image.style.top = topPosition;

            image.style.width = imageWidth;
            image.style.height = imageHeight;

            image.transform.rotation = Quaternion.Euler(0, 0, -eulerAnglesZ);

            return image;
        }
    }
}

