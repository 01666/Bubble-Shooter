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

using System.Linq;
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.Gameplay.Boosts
{
    public class BoostManager : Singleton<BoostManager>
    {
        public BoostGUI[] boosts;
        public BoostSettings boostSettings;

        //initializes the boosts array with data from BoostSettings and loads prefs
        public override void Init()
        {
            base.Init();
            boostSettings = Resources.Load<BoostSettings>("Settings/BoostSettings");
            boosts = Object.FindObjectsOfType<BoostGUI>(true).OrderBy(b => b.name).ToArray();
            foreach (var boostGUI in boosts)
            {
                boostGUI.boostParameters = boostSettings.GetBoostParameters(boostGUI.boostResource);
            }
        }
    }
}