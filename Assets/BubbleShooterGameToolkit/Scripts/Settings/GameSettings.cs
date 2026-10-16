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

namespace BubbleShooterGameToolkit.Scripts.Settings
{
    public class GameSettings : SettingsBase
    {
        [Header("Default settings")] 
        public int MaxLife;
        public int coins;
        [Header("Life settings")] 
        public int refillLifeCost;
        public int TotalTimeForRestLifeHours;
        public int TotalTimeForRestLifeMin;
        public int TotalTimeForRestLifeSec;
        [Header("Pay to continue game after fail")]
        public int continuePrice; 
        [Header("Add Moves to continue game after fail")]
        public int movesContinue;
        [Header("Add Time to continue game after fail")]
        public int timeContinue = 30;
        [Header("Skip map after win")]
        public GoMapAfter GoMapAfter;
        [Header("Open menu play on map automatically")]
        public bool openMenuPlay = false;
        [Header("Match settings count")]
        public int matchSettingsCount = 3;

        [Header("GDPR settings")]
        public string privacyPolicyUrl;
    }

    [Serializable]
    public class GoMapAfter
    {
        public bool skipMap;
        public int untilLevel = 1;
    }
}