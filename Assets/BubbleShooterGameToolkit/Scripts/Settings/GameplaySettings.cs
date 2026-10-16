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
using UnityEngine.Serialization;
using UnityEngine.SocialPlatforms.Impl;

namespace BubbleShooterGameToolkit.Scripts.Settings
{
    public class GameplaySettings : SettingsBase
    {
        [Header("Ball speed")]
        public float ballSpeed = 25;
        [Header("Ball default size, for adjusting screen for a level")]
        public float ballWidth;
        public float ballHeight;
        public float cameraSize = 14.8f;
        public bool showScorePopup = true;
        public AnimationCurve ScoreMultiplierCurve;
        [Header("Popup text like 'Good!', 'Great!', 'Fantastic!'")]
        public PopupTextElement[] popupTextElements;
        public int warningTimeThreshold = 10;
        public int warningMovesThreshold = 5;
        [SerializeField]
        public int bouncingCount = 4;

        [Header("Colors for aim line and editor")]
        public Color[] ballColors = {
            Color.red,
            Color.yellow,
            Color.blue,
            Color.green,
            new Color(0.5f, 0, 1),
            new Color(1, 0.5f, 0),
        };

        [Header("Hole score")]
        public int[] holesScore = { 50, 100, 200, 100, 50 };

    }
    
    [Serializable]
    public class PopupTextElement
    {
        public int MinValue;
        public int MaxValue;
        public GameObject popupTextPrefab;
    }
}