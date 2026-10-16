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

using BubbleShooterGameToolkit.Scripts.Settings;
using TMPro;
using UnityEngine;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Daily
{
    public class DayHandle : MonoBehaviour
    {
        [SerializeField]
        private GameObject check;

        [SerializeField]
        private TextMeshProUGUI dayText;

        [SerializeField]
        private TextMeshProUGUI coinsCountText;
        
        [SerializeField]
        private Material lockedFontMaterial;
        
        [SerializeField]
        private GameObject sparklePrefab;
        public EDailyStatus DailyStatus { get; private set; }

        public RewardSetting RewardData { get; set; }

        public void SetDay(int day, RewardSetting rewardSetting)
        {
            dayText.text = "Day " + day.ToString();
            coinsCountText.text = rewardSetting.count.ToString();
            RewardData = rewardSetting;
        }
        
        public void SetStatus(EDailyStatus eDailyStatus)
        {
            DailyStatus = eDailyStatus;
            check.SetActive(eDailyStatus == EDailyStatus.passed);
            if(eDailyStatus == EDailyStatus.locked)
                coinsCountText.fontMaterial = lockedFontMaterial;
            else if(eDailyStatus == EDailyStatus.current)
                Instantiate(sparklePrefab, transform.position, Quaternion.identity, transform);
            coinsCountText.gameObject.SetActive(!check.activeSelf);
            var list = GetComponentsInChildren<DayToggle>();
            foreach (var dayToggle in list)
            {
                dayToggle.SetStatus(eDailyStatus);
            }
        }
    }
}