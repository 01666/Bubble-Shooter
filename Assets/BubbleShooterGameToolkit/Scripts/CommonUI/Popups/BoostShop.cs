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
using BubbleShooterGameToolkit.Scripts.Settings;
using BubbleShooterGameToolkit.Scripts.System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace BubbleShooterGameToolkit.Scripts.CommonUI.Popups
{
	public class BoostShop : PopupWithCurrencyLabel
	{
		[SerializeField]
		public Button BuyBoostButton;
		
		public Transform icon;
		public TextMeshProUGUI title;
		public TextMeshProUGUI description;
		public TextMeshProUGUI price;
		public TextMeshProUGUI amountText;
		private BoostParameters parameters;
		Action buySuccess;

		private void OnEnable()
		{
			BuyBoostButton.onClick.AddListener(BuyBoost);
		}

		public void SetBoost(BoostParameters param, Action buyCallback = null)
		{
			parameters = param;
			gameObject.SetActive(true);
			title.text = param.title;
			description.text = param.description;
			price.text = param.price.ToString();
			amountText.text = "+" + param.countItems;
			buySuccess = buyCallback;
			var iconBooster = Instantiate(param.iconPrefab, icon.transform);
			var rectTransform = iconBooster.GetComponent<RectTransform>();
			rectTransform.anchorMin = Vector2.zero;
			rectTransform.anchorMax = Vector2.one;
			rectTransform.offsetMin = Vector2.zero;
			rectTransform.offsetMax = Vector2.zero;
		}

		public void BuyBoost()
		{
			var amount = parameters.price;
			if (GameManager.instance.coins.Consume(amount)) {
				ShowCoinsSpendFX(BuyBoostButton.transform.position);
				parameters.boostResource.Add(parameters.countItems);
				Close();
				buySuccess?.Invoke();
			}
		}

	}
}
